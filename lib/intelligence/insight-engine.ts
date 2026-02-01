/**
 * Insight Engine
 * 
 * Uses LLM to analyze and cluster feedback items.
 * Identifies patterns, classifies feedback types, and triggers alerts.
 * 
 * Core responsibilities:
 * 1. Classify feedback type (bug, feature_request, complaint, etc.)
 * 2. Cluster similar feedback items together
 * 3. Generate cluster summaries
 * 4. Trigger alerts for critical clusters
 */

import OpenAI from 'openai';
import { connectToDatabase } from '@/lib/db/connection';
import { FeedbackItem, type IFeedbackItem, type FeedbackType } from '@/lib/db/models/feedback-item';
import { Cluster, type ICluster, type ClusterPriority } from '@/lib/db/models/cluster';
import { sendCriticalAlert } from './resend-client';

// ===========================================================================
// TYPES
// ===========================================================================

export interface ClassificationResult {
  feedback_type: FeedbackType;
  sentiment_score: number;  // -1 to 1
  technical_severity: number; // 0-100
  keywords: string[];
  summary: string;
}

export interface ClusteringResult {
  clusters: {
    title: string;
    description: string;
    root_cause?: string;
    suggested_fix?: string;
    affected_area?: string;
    item_ids: string[];
    aggregate_severity: number;
    priority: ClusterPriority;
  }[];
}

export interface AnalysisResult {
  success: boolean;
  itemsClassified: number;
  clustersCreated: number;
  alertsSent: number;
  errors: string[];
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
      'X-Title': 'Feedback-to-Code Engine',
    },
  });
}

// ===========================================================================
// INSIGHT ENGINE
// ===========================================================================

export class InsightEngine {
  private llm: OpenAI;
  private model: string = 'anthropic/claude-3.5-sonnet';  // Can be configured
  private severityThreshold: number;

  constructor(options?: { model?: string; severityThreshold?: number }) {
    this.llm = getLLMClient();
    if (options?.model) this.model = options.model;
    this.severityThreshold = options?.severityThreshold ||
      parseInt(process.env.SEVERITY_THRESHOLD || '80', 10);
  }

  /**
   * Main analysis pipeline
   * 1. Classify pending feedback
   * 2. Cluster similar items
   * 3. Send alerts for critical clusters
   */
  async analyze(options?: {
    batchSize?: number;
    skipAlerts?: boolean;
  }): Promise<AnalysisResult> {
    const { batchSize = 50, skipAlerts = false } = options || {};

    await connectToDatabase();

    const result: AnalysisResult = {
      success: true,
      itemsClassified: 0,
      clustersCreated: 0,
      alertsSent: 0,
      errors: [],
    };

    try {
      // Step 1: Get pending feedback items
      const pendingItems = await FeedbackItem.find({ status: 'pending' })
        .sort({ normalized_severity: -1 })
        .limit(batchSize);

      if (pendingItems.length === 0) {
        return result;
      }

      // Step 2: Classify each item
      const classifiedItems = await this.classifyItems(pendingItems);
      result.itemsClassified = classifiedItems.length;

      // Step 3: Cluster the items
      const clusters = await this.clusterItems(classifiedItems);
      result.clustersCreated = clusters.length;

      // Step 4: Send alerts for critical clusters
      if (!skipAlerts) {
        for (const cluster of clusters) {
          if (cluster.aggregate_severity >= this.severityThreshold && !cluster.alert_sent) {
            try {
              await sendCriticalAlert(cluster);
              cluster.alert_sent = true;
              cluster.alert_sent_at = new Date();
              await cluster.save();
              result.alertsSent++;
            } catch (alertError) {
              result.errors.push(`Alert failed for cluster ${cluster._id}: ${alertError}`);
            }
          }
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Classify feedback items using LLM
   */
  async classifyItems(items: IFeedbackItem[]): Promise<IFeedbackItem[]> {
    const classifiedItems: IFeedbackItem[] = [];

    // Process in smaller batches for better LLM performance
    const chunkSize = 10;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        const classifications = await this.classifyBatch(chunk);

        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          const classification = classifications[j];

          if (classification) {
            item.feedback_type = classification.feedback_type;
            item.sentiment_score = classification.sentiment_score;

            // Update severity if AI provides a specific technical rating
            // Weighted blend: 70% AI, 30% existing (which has keyword/source context)
            if (classification.technical_severity > 0) {
              const currentSeverity = item.normalized_severity || 50;
              item.normalized_severity = Math.round(
                (classification.technical_severity * 0.7) + (currentSeverity * 0.3)
              );
            }

            if (classification.keywords.length > 0) {
              item.keywords = [...new Set([...item.keywords, ...classification.keywords])];
            }
            await item.save();
            classifiedItems.push(item);
          }
        }
      } catch (error) {
        console.error('Classification batch error:', error);
        // Continue with next batch
      }
    }

    return classifiedItems;
  }

  /**
   * Classify a batch of items using single LLM call
   */
  private async classifyBatch(items: IFeedbackItem[]): Promise<ClassificationResult[]> {
    const prompt = `You are analyzing user feedback to classify and extract insights.

For each feedback item below, provide:
1. feedback_type: one of "bug", "feature_request", "complaint", "praise", "question", "unknown"
2. sentiment_score: number from -1 (very negative) to 1 (very positive)
3. technical_severity: integer 0-100 (0=trivial, 100=critical failure/crash/data loss)
4. keywords: array of 3-5 key technical terms or topics mentioned
5. summary: one-sentence summary of the core issue/request

Respond with a JSON array matching the order of inputs.

FEEDBACK ITEMS:
${items.map((item, i) => `[${i}] Source: ${item.source}
Content: ${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`).join('\n\n')}

Respond ONLY with a valid JSON array:`;

    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '[]';

      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return items.map(() => ({
          feedback_type: 'unknown' as FeedbackType,
          sentiment_score: 0,
          technical_severity: 50,
          keywords: [],
          summary: '',
        }));
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('LLM classification error:', error);
      return items.map(() => ({
        feedback_type: 'unknown' as FeedbackType,
        sentiment_score: 0,
        technical_severity: 50,
        keywords: [],
        summary: '',
      }));
    }
  }

  /**
   * Cluster similar feedback items together
   */
  async clusterItems(items: IFeedbackItem[]): Promise<ICluster[]> {
    if (items.length === 0) return [];

    // Get existing active clusters
    const existingClusters = await Cluster.find({
      status: { $in: ['active', 'reviewed'] }
    });

    // 1-to-1 Clustering: Create a separate cluster for each item
    const updatedClusters: ICluster[] = [];

    for (const item of items) {
      if (item.status === 'clustered') continue;

      // Create a unique cluster for this item
      const title = item.summary || `Issue reported via ${item.source}`;

      // Check if a similar cluster already exists (optional, but requested behavior is separation)
      // We will skip deduplication to ensure "every single feedback thing" is separate

      const cluster = new Cluster({
        summary: {
          title: title,
          description: item.content.substring(0, 500),
          root_cause: 'Pending analysis',
          suggested_fix: 'Pending analysis',
          affected_area: 'Unknown',
        },
        metrics: {
          total_items: 1,
          avg_severity: item.normalized_severity,
          max_severity: item.normalized_severity,
          sources: [item.source],
          first_seen: new Date(item.created_at),
          last_seen: new Date(item.created_at),
          trend: 'stable',
        },
        aggregate_severity: item.normalized_severity,
        priority: 'medium', // Will be updated by updateClusterMetrics
        status: 'active',
        feedback_items: [item._id],
        alert_sent: false,
        tags: item.keywords || [],
      });

      await cluster.save();

      // Update item status
      item.status = 'clustered';
      item.cluster_id = cluster._id;
      await item.save();

      // Final metric update (sets priority correctly)
      await this.updateClusterMetrics(cluster);
      await cluster.save();

      updatedClusters.push(cluster);
    }

    return updatedClusters;
  }

  /**
   * Use LLM to generate cluster assignments
   */
  private async generateClusters(
    items: IFeedbackItem[],
    existingClusters: ICluster[]
  ): Promise<ClusteringResult> {
    const existingClusterInfo = existingClusters.map(c => ({
      id: c._id.toString(),
      title: c.summary.title,
      description: c.summary.description,
    }));

    const prompt = `You are clustering user feedback into actionable issue groups.

EXISTING CLUSTERS:
${existingClusterInfo.length > 0
        ? existingClusterInfo.map(c => `- "${c.title}": ${c.description}`).join('\n')
        : '(No existing clusters)'}

NEW FEEDBACK ITEMS TO CLUSTER:
${items.map(item => `ID: ${item._id}
Type: ${item.feedback_type}
Severity: ${item.normalized_severity}
Content: ${item.content.substring(0, 300)}${item.content.length > 300 ? '...' : ''}`).join('\n\n')}

INSTRUCTIONS:
1. Group similar items into clusters (themes, issues, feature requests)
2. Assign items to existing clusters if they match, or create new ones
3. Each item should belong to exactly one cluster
4. For each cluster provide:
   - title: Short descriptive title (e.g., "Login Authentication Failures")
   - description: 2-3 sentence summary of the issue
   - root_cause: Likely technical cause (if identifiable)
   - suggested_fix: Brief technical recommendation
   - affected_area: System component (e.g., "authentication", "payment", "ui")
   - item_ids: Array of item IDs that belong to this cluster
   - aggregate_severity: Average severity (0-100)
   - priority: "critical", "high", "medium", or "low"

Respond with a JSON object containing a "clusters" array:`;

    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content || '{"clusters":[]}';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*"clusters"[\s\S]*\}/);
      if (!jsonMatch) {
        // Fallback: create single cluster with all items
        return {
          clusters: [{
            title: 'Uncategorized Feedback',
            description: 'Feedback items pending manual categorization',
            item_ids: items.map(i => i._id.toString()),
            aggregate_severity: Math.round(
              items.reduce((sum, i) => sum + i.normalized_severity, 0) / items.length
            ),
            priority: 'medium',
          }],
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('LLM clustering error:', error);
      return {
        clusters: [{
          title: 'Uncategorized Feedback',
          description: 'Feedback items pending manual categorization',
          item_ids: items.map(i => i._id.toString()),
          aggregate_severity: 50,
          priority: 'medium',
        }],
      };
    }
  }

  /**
   * Update cluster metrics based on its items
   */
  private async updateClusterMetrics(cluster: ICluster): Promise<void> {
    const items = await FeedbackItem.find({
      _id: { $in: cluster.feedback_items }
    });

    if (items.length === 0) return;

    const severities = items.map(i => i.normalized_severity);
    const sources = [...new Set(items.map(i => i.source))];
    const dates = items.map(i => new Date(i.created_at).getTime());

    const avgSeverity = severities.reduce((a, b) => a + b, 0) / severities.length;
    const maxSeverity = Math.max(...severities);

    cluster.metrics = {
      total_items: items.length,
      avg_severity: Math.round(avgSeverity),
      max_severity: maxSeverity,
      sources,
      first_seen: new Date(Math.min(...dates)),
      last_seen: new Date(Math.max(...dates)),
      trend: cluster.metrics?.trend || 'stable',
    };

    // Weighted aggregate: favor max severity
    cluster.aggregate_severity = Math.round((avgSeverity * 0.4) + (maxSeverity * 0.6));

    // Set priority
    if (cluster.aggregate_severity >= 90) cluster.priority = 'critical';
    else if (cluster.aggregate_severity >= 75) cluster.priority = 'high';
    else if (cluster.aggregate_severity >= 50) cluster.priority = 'medium';
    else cluster.priority = 'low';
  }

  /**
   * Re-analyze existing clusters for trend changes
   */
  async updateTrends(): Promise<void> {
    await connectToDatabase();

    const clusters = await Cluster.find({
      status: { $in: ['active', 'reviewed'] }
    });

    for (const cluster of clusters) {
      const items = await FeedbackItem.find({
        _id: { $in: cluster.feedback_items }
      }).sort({ created_at: -1 });

      if (items.length < 5) continue;

      // Compare recent vs older items
      const midpoint = Math.floor(items.length / 2);
      const recentItems = items.slice(0, midpoint);
      const olderItems = items.slice(midpoint);

      const recentAvg = recentItems.reduce((sum, i) => sum + i.normalized_severity, 0) / recentItems.length;
      const olderAvg = olderItems.reduce((sum, i) => sum + i.normalized_severity, 0) / olderItems.length;

      const diff = recentAvg - olderAvg;

      if (diff > 10) {
        cluster.metrics.trend = 'rising';
      } else if (diff < -10) {
        cluster.metrics.trend = 'declining';
      } else {
        cluster.metrics.trend = 'stable';
      }

      await cluster.save();
    }
  }
}

// ===========================================================================
// SINGLETON EXPORT
// ===========================================================================

let insightEngineInstance: InsightEngine | null = null;

export function getInsightEngine(): InsightEngine {
  if (!insightEngineInstance) {
    insightEngineInstance = new InsightEngine();
  }
  return insightEngineInstance;
}
