/**
 * Cluster Model
 * 
 * Groups related feedback items together.
 * Example: 50 reviews about "login crash" -> 1 Cluster
 * 
 * Clusters drive:
 * - Alert notifications (when aggregate severity is high)
 * - Code generation (AI generates fixes for clusters, not individual items)
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export type ClusterStatus = 
  | 'active'      // Actively collecting feedback
  | 'reviewed'    // Admin has reviewed
  | 'in_progress' // Fix is being developed
  | 'resolved'    // Fix deployed
  | 'wont_fix';   // Intentionally not addressing

export type ClusterPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ClusterSummary {
  title: string;
  description: string;
  root_cause?: string;
  suggested_fix?: string;
  affected_area?: string;  // e.g., "authentication", "payments", "ui"
}

export interface ClusterMetrics {
  total_items: number;
  avg_severity: number;
  max_severity: number;
  sources: string[];  // Which platforms reported this
  first_seen: Date;
  last_seen: Date;
  trend: 'rising' | 'stable' | 'declining';
}

export interface GeneratedFix {
  markdown_content: string;
  file_path: string;
  generated_at: Date;
  pr_url?: string;
  pr_status?: 'pending' | 'merged' | 'closed';
}

export interface ICluster extends Document {
  summary: ClusterSummary;
  metrics: ClusterMetrics;
  aggregate_severity: number;  // 0-100, computed from items
  priority: ClusterPriority;
  status: ClusterStatus;
  feedback_items: mongoose.Types.ObjectId[];
  generated_fix?: GeneratedFix;
  alert_sent: boolean;
  alert_sent_at?: Date;
  assigned_to?: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

// ===========================================
// SCHEMA DEFINITION
// ===========================================

const ClusterSchema = new Schema<ICluster>(
  {
    summary: {
      title: { type: String, required: true, maxlength: 200 },
      description: { type: String, required: true, maxlength: 2000 },
      root_cause: { type: String, maxlength: 1000 },
      suggested_fix: { type: String, maxlength: 2000 },
      affected_area: { type: String, maxlength: 100 },
    },
    metrics: {
      total_items: { type: Number, default: 0 },
      avg_severity: { type: Number, default: 0 },
      max_severity: { type: Number, default: 0 },
      sources: { type: [String], default: [] },
      first_seen: { type: Date, default: Date.now },
      last_seen: { type: Date, default: Date.now },
      trend: { 
        type: String, 
        enum: ['rising', 'stable', 'declining'], 
        default: 'stable' 
      },
    },
    aggregate_severity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'reviewed', 'in_progress', 'resolved', 'wont_fix'],
      default: 'active',
      index: true,
    },
    feedback_items: [{
      type: Schema.Types.ObjectId,
      ref: 'FeedbackItem',
    }],
    generated_fix: {
      markdown_content: String,
      file_path: String,
      generated_at: Date,
      pr_url: String,
      pr_status: {
        type: String,
        enum: ['pending', 'merged', 'closed'],
      },
    },
    alert_sent: {
      type: Boolean,
      default: false,
    },
    alert_sent_at: Date,
    assigned_to: String,
    tags: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'clusters',
  }
);

// ===========================================
// INDEXES
// ===========================================

ClusterSchema.index({ status: 1, aggregate_severity: -1 });
ClusterSchema.index({ priority: 1, status: 1 });
ClusterSchema.index({ 'summary.title': 'text', 'summary.description': 'text' });

// ===========================================
// METHODS
// ===========================================

/**
 * Recalculate metrics based on feedback items
 */
ClusterSchema.methods.recalculateMetrics = async function () {
  const FeedbackItem = mongoose.model('FeedbackItem');
  const items = await FeedbackItem.find({ _id: { $in: this.feedback_items } });
  
  if (items.length === 0) return;
  
  const severities = items.map((i: { normalized_severity: number }) => i.normalized_severity);
  const sources = [...new Set(items.map((i: { source: string }) => i.source))];
  const dates = items.map((i: { created_at: Date }) => new Date(i.created_at).getTime());
  
  this.metrics = {
    total_items: items.length,
    avg_severity: severities.reduce((a: number, b: number) => a + b, 0) / severities.length,
    max_severity: Math.max(...severities),
    sources,
    first_seen: new Date(Math.min(...dates)),
    last_seen: new Date(Math.max(...dates)),
    trend: this.metrics?.trend || 'stable',
  };
  
  // Aggregate severity: weighted average favoring max severity
  this.aggregate_severity = Math.round(
    (this.metrics.avg_severity * 0.4) + (this.metrics.max_severity * 0.6)
  );
  
  // Auto-set priority based on severity
  if (this.aggregate_severity >= 90) this.priority = 'critical';
  else if (this.aggregate_severity >= 75) this.priority = 'high';
  else if (this.aggregate_severity >= 50) this.priority = 'medium';
  else this.priority = 'low';
  
  await this.save();
};

// ===========================================
// STATIC METHODS
// ===========================================

ClusterSchema.statics.findCritical = function (threshold = 80) {
  return this.find({ 
    status: { $in: ['active', 'reviewed'] },
    aggregate_severity: { $gte: threshold } 
  })
  .sort({ aggregate_severity: -1 })
  .populate('feedback_items');
};

ClusterSchema.statics.findUnalerted = function (threshold = 80) {
  return this.find({
    alert_sent: false,
    aggregate_severity: { $gte: threshold },
    status: 'active',
  });
};

// ===========================================
// MODEL EXPORT
// ===========================================

export const Cluster: Model<ICluster> = 
  mongoose.models.Cluster || mongoose.model<ICluster>('Cluster', ClusterSchema);
