/**
 * Agentic Coder
 * 
 * Takes clusters of user feedback and generates code fixes.
 * Creates pull requests via GitHub API or generates local fix files.
 * 
 * This is the "magic" of the feedback-to-code loop:
 * 1. Analyzes the cluster to understand the issue
 * 2. Generates a fix plan
 * 3. Creates actual code changes
 * 4. Submits as a PR for review
 */

import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster, type ICluster } from '@/lib/db/models/cluster';
import { FeedbackItem } from '@/lib/db/models/feedback-item';
import * as fs from 'fs/promises';
import * as path from 'path';

// ===========================================================================
// TYPES
// ===========================================================================

export interface FixPlan {
  summary: string;
  files_to_modify: FileChange[];
  files_to_create: FileChange[];
  testing_notes: string;
  rollback_plan: string;
  estimated_impact: 'low' | 'medium' | 'high';
}

export interface FileChange {
  path: string;
  description: string;
  original_content?: string;
  new_content: string;
  change_type: 'create' | 'modify' | 'delete';
}

export interface GenerationResult {
  success: boolean;
  cluster_id: string;
  fix_plan?: FixPlan;
  markdown_file?: string;
  pr_url?: string;
  error?: string;
}

export interface PRDetails {
  title: string;
  body: string;
  branch: string;
  base: string;
  files: FileChange[];
}

// ===========================================================================
// LLM CLIENT (OpenRouter)
// ===========================================================================

function getLLMClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }

  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Feedback-to-Code Engine - Coder',
    },
  });
}

// ===========================================================================
// GITHUB CLIENT
// ===========================================================================

function getGitHubClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for PR creation');
  }
  return new Octokit({ auth: token });
}

// ===========================================================================
// AGENTIC CODER
// ===========================================================================

export class AgenticCoder {
  private llm: OpenAI;
  private model: string = 'anthropic/claude-3.5-sonnet';
  private outputDir: string = 'generated-fixes';

  constructor(options?: { model?: string; outputDir?: string }) {
    this.llm = getLLMClient();
    if (options?.model) this.model = options.model;
    if (options?.outputDir) this.outputDir = options.outputDir;
  }

  /**
   * Generate a fix for a cluster
   */
  async generateFix(
    clusterId: string,
    options?: {
      createPR?: boolean;
      targetRepo?: { owner: string; repo: string };
      codebaseContext?: string;  // Relevant code snippets for context
    }
  ): Promise<GenerationResult> {
    await connectToDatabase();

    try {
      // Get cluster with feedback items
      const cluster = await Cluster.findById(clusterId).populate('feedback_items');

      if (!cluster) {
        return {
          success: false,
          cluster_id: clusterId,
          error: 'Cluster not found',
        };
      }

      // Generate fix plan
      const fixPlan = await this.createFixPlan(cluster, options?.codebaseContext);

      // Generate markdown documentation
      const markdownPath = await this.generateMarkdownFile(cluster, fixPlan);

      // Update cluster with generated fix
      cluster.generated_fix = {
        markdown_content: await fs.readFile(markdownPath, 'utf-8'),
        file_path: markdownPath,
        generated_at: new Date(),
      };

      let prUrl: string | undefined;

      // Create PR if requested
      if (options?.createPR) {
        const targetRepo = options.targetRepo || {
          owner: process.env.GITHUB_OWNER || '',
          repo: process.env.GITHUB_REPO || '',
        };

        if (targetRepo.owner && targetRepo.repo) {
          try {
            prUrl = await this.createPullRequest(cluster, fixPlan, targetRepo);
            cluster.generated_fix.pr_url = prUrl;
            cluster.generated_fix.pr_status = 'pending';
          } catch (prError) {
            console.error('PR creation failed:', prError);
            // Continue - PR is optional
          }
        }
      }

      // Update cluster status
      cluster.status = 'in_progress';
      await cluster.save();

      return {
        success: true,
        cluster_id: clusterId,
        fix_plan: fixPlan,
        markdown_file: markdownPath,
        pr_url: prUrl,
      };
    } catch (error) {
      return {
        success: false,
        cluster_id: clusterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a fix plan using LLM
   */
  private async createFixPlan(
    cluster: ICluster,
    codebaseContext?: string
  ): Promise<FixPlan> {
    // Get feedback content for context
    const feedbackItems = await FeedbackItem.find({
      _id: { $in: cluster.feedback_items },
    }).limit(20);

    const feedbackSummary = feedbackItems
      .map(item => `- [${item.feedback_type}] ${item.content.substring(0, 200)}`)
      .join('\n');

    const prompt = `You are an expert software engineer generating a fix plan for a user-reported issue.

ISSUE CLUSTER: ${cluster.summary.title}
DESCRIPTION: ${cluster.summary.description}
PRIORITY: ${cluster.priority}
SEVERITY: ${cluster.aggregate_severity}/100
AFFECTED AREA: ${cluster.summary.affected_area || 'Unknown'}

ROOT CAUSE (if known): ${cluster.summary.root_cause || 'Not identified'}
SUGGESTED FIX (initial): ${cluster.summary.suggested_fix || 'None'}

USER FEEDBACK SAMPLES:
${feedbackSummary}

${codebaseContext ? `RELEVANT CODEBASE CONTEXT:\n${codebaseContext}` : ''}

Generate a comprehensive fix plan as JSON with this structure:
{
  "summary": "Brief summary of the fix approach",
  "files_to_modify": [
    {
      "path": "src/path/to/file.ts",
      "description": "What changes to make",
      "change_type": "modify",
      "new_content": "// The actual code changes (can be partial/diff-like)"
    }
  ],
  "files_to_create": [
    {
      "path": "src/path/to/new-file.ts",
      "description": "Purpose of this new file",
      "change_type": "create",
      "new_content": "// Full file content"
    }
  ],
  "testing_notes": "How to test this fix",
  "rollback_plan": "How to rollback if issues arise",
  "estimated_impact": "low|medium|high"
}

Focus on:
1. Addressing the root cause, not just symptoms
2. Following best practices and patterns
3. Maintaining backward compatibility where possible
4. Including appropriate error handling
5. Being specific about file paths and changes

Respond ONLY with valid JSON:`;

    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse fix plan from LLM response');
      }

      // Clean content (remove markdown code blocks if present)
      const cleanContent = jsonMatch[0]
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/```$/, '');

      return JSON.parse(cleanContent);
    } catch (error) {
      console.error('Fix plan generation error:', error);
      // Return a basic plan
      return {
        summary: `Fix for: ${cluster.summary.title}`,
        files_to_modify: [],
        files_to_create: [],
        testing_notes: 'Manual testing required',
        rollback_plan: 'Revert the commit',
        estimated_impact: 'medium',
      };
    }
  }

  /**
   * Generate markdown documentation file
   */
  private async generateMarkdownFile(
    cluster: ICluster,
    fixPlan: FixPlan
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedTitle = cluster.summary.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);

    const filename = `${cluster._id}-${sanitizedTitle}-${timestamp}.md`;
    const filepath = path.join(process.cwd(), this.outputDir, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const markdown = this.generateFixMarkdown(cluster, fixPlan);
    await fs.writeFile(filepath, markdown, 'utf-8');

    return filepath;
  }

  /**
   * Generate markdown content for the fix
   */
  private generateFixMarkdown(cluster: ICluster, fixPlan: FixPlan): string {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    return `# Fix Plan: ${cluster.summary.title}

${priorityEmoji[cluster.priority]} **Priority:** ${cluster.priority.toUpperCase()}
📊 **Severity Score:** ${cluster.aggregate_severity}/100
📅 **Generated:** ${new Date().toISOString()}
🔗 **Cluster ID:** \`${cluster._id}\`

---

## Issue Summary

${cluster.summary.description}

### Root Cause
${cluster.summary.root_cause || '_Not yet identified_'}

### Affected Area
${cluster.summary.affected_area || '_Unknown_'}

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Reports | ${cluster.metrics.total_items} |
| Sources | ${cluster.metrics.sources.join(', ')} |
| First Reported | ${new Date(cluster.metrics.first_seen).toLocaleDateString()} |
| Trend | ${cluster.metrics.trend} |

---

## Fix Plan

### Summary
${fixPlan.summary}

### Estimated Impact
**${fixPlan.estimated_impact.toUpperCase()}** - ${fixPlan.estimated_impact === 'high'
        ? 'Significant changes, thorough review recommended'
        : fixPlan.estimated_impact === 'medium'
          ? 'Moderate changes, standard review process'
          : 'Minor changes, quick review expected'
      }

---

## Files to Modify

${fixPlan.files_to_modify.length === 0 ? '_No existing files need modification_' : ''}

${fixPlan.files_to_modify.map(file => `
### \`${file.path}\`

**Description:** ${file.description}

\`\`\`typescript
${file.new_content}
\`\`\`
`).join('\n')}

---

## Files to Create

${fixPlan.files_to_create.length === 0 ? '_No new files need to be created_' : ''}

${fixPlan.files_to_create.map(file => `
### \`${file.path}\`

**Description:** ${file.description}

\`\`\`typescript
${file.new_content}
\`\`\`
`).join('\n')}

---

## Testing Notes

${fixPlan.testing_notes}

---

## Rollback Plan

${fixPlan.rollback_plan}

---

## User Feedback References

This fix addresses the following user reports:

- ${cluster.metrics.total_items} reports from ${cluster.metrics.sources.join(', ')}
- Aggregate severity: ${cluster.aggregate_severity}/100
- Trend: ${cluster.metrics.trend}

---

_Generated by Feedback-to-Code Engine_
`;
  }

  /**
   * Create a GitHub Pull Request
   */
  private async createPullRequest(
    cluster: ICluster,
    fixPlan: FixPlan,
    repo: { owner: string; repo: string }
  ): Promise<string> {
    const octokit = getGitHubClient();
    const baseBranch = process.env.GITHUB_DEFAULT_BRANCH || 'main';

    // Create branch name with timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const branchName = `fix/${cluster._id.toString().slice(-4)}-${timestamp}-${cluster.summary.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30)}`;

    // Get base branch ref
    const { data: baseRef } = await octokit.git.getRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `heads/${baseBranch}`,
    });

    // Create new branch
    await octokit.git.createRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    });

    // Create/update files in the branch
    for (const file of [...fixPlan.files_to_modify, ...fixPlan.files_to_create]) {
      try {
        // Check if file exists
        let existingSha: string | undefined;
        try {
          const { data: existingFile } = await octokit.repos.getContent({
            owner: repo.owner,
            repo: repo.repo,
            path: file.path,
            ref: branchName,
          });
          if ('sha' in existingFile) {
            existingSha = existingFile.sha;
          }
        } catch {
          // File doesn't exist, that's fine for create
        }

        await octokit.repos.createOrUpdateFileContents({
          owner: repo.owner,
          repo: repo.repo,
          path: file.path,
          message: `${file.change_type === 'create' ? 'Add' : 'Update'} ${file.path}\n\nFix for: ${cluster.summary.title}`,
          content: Buffer.from(file.new_content).toString('base64'),
          branch: branchName,
          sha: existingSha,
        });
      } catch (fileError) {
        console.error(`Error creating/updating ${file.path}:`, fileError);
      }
    }

    // Create PR
    const prBody = this.generatePRBody(cluster, fixPlan);

    const { data: pr } = await octokit.pulls.create({
      owner: repo.owner,
      repo: repo.repo,
      title: `🔧 Fix: ${cluster.summary.title}`,
      body: prBody,
      head: branchName,
      base: baseBranch,
    });

    // Add labels
    try {
      await octokit.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: pr.number,
        labels: [
          'auto-generated',
          `priority-${cluster.priority}`,
          cluster.summary.affected_area ? `area-${cluster.summary.affected_area}` : 'needs-triage',
        ].filter(Boolean),
      });
    } catch {
      // Labels might not exist, continue
    }

    return pr.html_url;
  }

  /**
   * Generate PR body content
   */
  private generatePRBody(cluster: ICluster, fixPlan: FixPlan): string {
    return `## 🔧 Auto-Generated Fix

This PR was automatically generated by the Feedback-to-Code Engine based on user feedback analysis.

### Issue Summary
${cluster.summary.description}

### Metrics
- **Priority:** ${cluster.priority.toUpperCase()}
- **Severity Score:** ${cluster.aggregate_severity}/100
- **User Reports:** ${cluster.metrics.total_items}
- **Sources:** ${cluster.metrics.sources.join(', ')}

### Root Cause
${cluster.summary.root_cause || '_Analysis pending_'}

### Fix Summary
${fixPlan.summary}

### Changes
${[...fixPlan.files_to_modify, ...fixPlan.files_to_create].map(f =>
      `- \`${f.path}\` - ${f.description}`
    ).join('\n')}

### Testing Notes
${fixPlan.testing_notes}

### Rollback Plan
${fixPlan.rollback_plan}

---

⚠️ **Review Required:** This PR was auto-generated and requires human review before merging.

📊 [View Cluster Details](${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clusters/${cluster._id})

---
_Generated by [Feedback-to-Code Engine](${process.env.NEXT_PUBLIC_APP_URL})_
`;
  }

  /**
   * Generate fixes for all critical clusters
   */
  async generateFixesForCriticalClusters(
    options?: { threshold?: number; createPRs?: boolean }
  ): Promise<GenerationResult[]> {
    const { threshold = 80, createPRs = false } = options || {};

    await connectToDatabase();

    const clusters = await Cluster.find({
      aggregate_severity: { $gte: threshold },
      status: { $in: ['active', 'reviewed'] },
      'generated_fix.file_path': { $exists: false },
    }).limit(10);

    const results: GenerationResult[] = [];

    for (const cluster of clusters) {
      const result = await this.generateFix(cluster._id.toString(), { createPR: createPRs });
      results.push(result);
    }

    return results;
  }
}

// ===========================================================================
// SINGLETON EXPORT
// ===========================================================================

let agenticCoderInstance: AgenticCoder | null = null;

export function getAgenticCoder(): AgenticCoder {
  if (!agenticCoderInstance) {
    agenticCoderInstance = new AgenticCoder();
  }
  return agenticCoderInstance;
}
