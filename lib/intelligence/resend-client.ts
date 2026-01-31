/**
 * Resend Email Client
 * 
 * Sends email alerts when critical issues are detected.
 * Uses Resend API for reliable email delivery.
 */

import { Resend } from 'resend';
import type { ICluster } from '@/lib/db/models/cluster';
import { getSeverityLabel } from '@/lib/utils/normalize-severity';

// ===========================================================================
// TYPES
// ===========================================================================

export interface AlertEmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AlertResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ===========================================================================
// RESEND CLIENT
// ===========================================================================

let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

// ===========================================================================
// ALERT FUNCTIONS
// ===========================================================================

/**
 * Send critical alert email for a high-severity cluster
 */
export async function sendCriticalAlert(cluster: ICluster): Promise<AlertResult> {
  const resend = getResendClient();
  
  const toEmail = process.env.ALERT_EMAIL_TO;
  const fromEmail = process.env.ALERT_EMAIL_FROM || 'alerts@feedback-engine.dev';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!toEmail) {
    return {
      success: false,
      error: 'ALERT_EMAIL_TO environment variable is not set',
    };
  }

  const severityLabel = getSeverityLabel(cluster.aggregate_severity);
  const subject = `🚨 ${severityLabel} Issue: ${cluster.summary.title}`;

  const html = generateAlertHtml(cluster, appUrl);
  const text = generateAlertText(cluster, appUrl);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error('Resend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send digest email with multiple clusters
 */
export async function sendDigestAlert(clusters: ICluster[]): Promise<AlertResult> {
  const resend = getResendClient();
  
  const toEmail = process.env.ALERT_EMAIL_TO;
  const fromEmail = process.env.ALERT_EMAIL_FROM || 'alerts@feedback-engine.dev';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!toEmail) {
    return { success: false, error: 'ALERT_EMAIL_TO not set' };
  }

  const criticalCount = clusters.filter(c => c.priority === 'critical').length;
  const highCount = clusters.filter(c => c.priority === 'high').length;

  const subject = `📊 Feedback Digest: ${criticalCount} Critical, ${highCount} High Priority Issues`;

  const html = generateDigestHtml(clusters, appUrl);
  const text = generateDigestText(clusters, appUrl);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text,
    });

    return {
      success: !result.error,
      messageId: result.data?.id,
      error: result.error?.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ===========================================================================
// EMAIL TEMPLATES
// ===========================================================================

function generateAlertHtml(cluster: ICluster, appUrl: string): string {
  const priorityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  const color = priorityColors[cluster.priority];
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Critical Issue Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: ${color}; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">
          🚨 ${cluster.priority.toUpperCase()} PRIORITY ISSUE
        </h1>
      </div>
      
      <!-- Content -->
      <div style="padding: 24px;">
        <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">
          ${cluster.summary.title}
        </h2>
        
        <p style="margin: 0 0 16px; color: #4b5563;">
          ${cluster.summary.description}
        </p>
        
        <!-- Stats -->
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="flex: 1; background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: ${color};">
              ${cluster.aggregate_severity}
            </div>
            <div style="font-size: 12px; color: #6b7280;">Severity Score</div>
          </div>
          <div style="flex: 1; background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #374151;">
              ${cluster.metrics.total_items}
            </div>
            <div style="font-size: 12px; color: #6b7280;">Reports</div>
          </div>
          <div style="flex: 1; background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #374151;">
              ${cluster.metrics.sources.length}
            </div>
            <div style="font-size: 12px; color: #6b7280;">Sources</div>
          </div>
        </div>
        
        ${cluster.summary.root_cause ? `
        <div style="margin-bottom: 16px;">
          <strong style="color: #374151;">Root Cause:</strong>
          <p style="margin: 4px 0 0; color: #4b5563;">${cluster.summary.root_cause}</p>
        </div>
        ` : ''}
        
        ${cluster.summary.suggested_fix ? `
        <div style="margin-bottom: 16px;">
          <strong style="color: #374151;">Suggested Fix:</strong>
          <p style="margin: 4px 0 0; color: #4b5563;">${cluster.summary.suggested_fix}</p>
        </div>
        ` : ''}
        
        ${cluster.summary.affected_area ? `
        <div style="margin-bottom: 24px;">
          <strong style="color: #374151;">Affected Area:</strong>
          <span style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; margin-left: 8px; font-size: 14px;">
            ${cluster.summary.affected_area}
          </span>
        </div>
        ` : ''}
        
        <!-- CTA Button -->
        <a href="${appUrl}/dashboard/clusters/${cluster._id}" 
           style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Details & Generate Fix
        </a>
      </div>
      
      <!-- Footer -->
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Sources: ${cluster.metrics.sources.join(', ')} | 
          First reported: ${new Date(cluster.metrics.first_seen).toLocaleDateString()}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateAlertText(cluster: ICluster, appUrl: string): string {
  return `
🚨 ${cluster.priority.toUpperCase()} PRIORITY ISSUE

${cluster.summary.title}
${'='.repeat(cluster.summary.title.length)}

${cluster.summary.description}

STATS:
- Severity Score: ${cluster.aggregate_severity}/100
- Total Reports: ${cluster.metrics.total_items}
- Sources: ${cluster.metrics.sources.join(', ')}

${cluster.summary.root_cause ? `ROOT CAUSE:\n${cluster.summary.root_cause}\n` : ''}
${cluster.summary.suggested_fix ? `SUGGESTED FIX:\n${cluster.summary.suggested_fix}\n` : ''}
${cluster.summary.affected_area ? `AFFECTED AREA: ${cluster.summary.affected_area}\n` : ''}

View details: ${appUrl}/dashboard/clusters/${cluster._id}

First reported: ${new Date(cluster.metrics.first_seen).toLocaleDateString()}
Last updated: ${new Date(cluster.metrics.last_seen).toLocaleDateString()}
`.trim();
}

function generateDigestHtml(clusters: ICluster[], appUrl: string): string {
  const sortedClusters = [...clusters].sort((a, b) => b.aggregate_severity - a.aggregate_severity);
  
  const clusterRows = sortedClusters.map(cluster => {
    const priorityColors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#22c55e',
    };
    const color = priorityColors[cluster.priority];
    
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
          <a href="${appUrl}/dashboard/clusters/${cluster._id}" style="color: #1f2937; text-decoration: none; font-weight: 500;">
            ${cluster.summary.title}
          </a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${color}; font-weight: bold;">
          ${cluster.aggregate_severity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${cluster.metrics.total_items}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="text-transform: capitalize; padding: 4px 8px; border-radius: 4px; background: ${color}20; color: ${color}; font-size: 12px;">
            ${cluster.priority}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Feedback Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0;">📊 Feedback Digest</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">${clusters.length} issues require attention</p>
      </div>
      
      <div style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Issue</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Severity</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Reports</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Priority</th>
            </tr>
          </thead>
          <tbody>
            ${clusterRows}
          </tbody>
        </table>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/dashboard" 
             style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View Dashboard
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateDigestText(clusters: ICluster[], appUrl: string): string {
  const sortedClusters = [...clusters].sort((a, b) => b.aggregate_severity - a.aggregate_severity);
  
  const clusterList = sortedClusters.map(c => 
    `[${c.priority.toUpperCase()}] ${c.summary.title} (Severity: ${c.aggregate_severity}, Reports: ${c.metrics.total_items})`
  ).join('\n');

  return `
📊 FEEDBACK DIGEST
${clusters.length} issues require attention

${clusterList}

View dashboard: ${appUrl}/dashboard
`.trim();
}
