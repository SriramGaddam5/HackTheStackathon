/**
 * FeedbackItem Model
 * 
 * Flexible schema for storing feedback from diverse sources:
 * - App Store reviews (star ratings)
 * - Product Hunt comments (upvotes)
 * - Reddit posts (upvotes, comments)
 * - Quora answers (upvotes)
 * - Stack Overflow (votes, accepted answers)
 * - Manual uploads (PDFs, specs)
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export type FeedbackSource = 
  | 'app_store'
  | 'product_hunt'
  | 'reddit'
  | 'quora'
  | 'stack_overflow'
  | 'manual_upload'
  | 'custom';

export type FeedbackStatus = 'pending' | 'clustered' | 'resolved' | 'ignored';

export type FeedbackType = 'bug' | 'feature_request' | 'complaint' | 'praise' | 'question' | 'unknown';

/**
 * Source-specific metadata
 * Each source may have different metrics that inform severity
 */
export interface FeedbackMeta {
  // App Store / Play Store
  star_rating?: number;        // 1-5
  app_version?: string;
  
  // Product Hunt
  upvotes?: number;
  maker_reply?: boolean;
  
  // Reddit
  reddit_score?: number;       // upvotes - downvotes
  comment_count?: number;
  subreddit?: string;
  
  // Stack Overflow
  so_score?: number;
  is_accepted?: boolean;
  view_count?: number;
  
  // Quora
  quora_upvotes?: number;
  follower_count?: number;
  
  // General
  author?: string;
  author_url?: string;
  post_url?: string;
  posted_at?: Date;
  
  // Custom fields for flexibility
  [key: string]: unknown;
}

export interface IFeedbackItem extends Document {
  source: FeedbackSource;
  source_url?: string;
  content: string;
  content_preview: string;  // First 200 chars for quick display
  meta: FeedbackMeta;
  normalized_severity: number;  // 0-100
  feedback_type: FeedbackType;
  status: FeedbackStatus;
  cluster_id?: mongoose.Types.ObjectId;
  keywords: string[];
  sentiment_score?: number;  // -1 to 1
  created_at: Date;
  updated_at: Date;
}

// ===========================================
// SCHEMA DEFINITION
// ===========================================

const FeedbackItemSchema = new Schema<IFeedbackItem>(
  {
    source: {
      type: String,
      enum: ['app_store', 'product_hunt', 'reddit', 'quora', 'stack_overflow', 'manual_upload', 'custom'],
      required: true,
      index: true,
    },
    source_url: {
      type: String,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 50000, // Allow long form content
    },
    content_preview: {
      type: String,
      maxlength: 250,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    normalized_severity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true, // Important for sorting by severity
    },
    feedback_type: {
      type: String,
      enum: ['bug', 'feature_request', 'complaint', 'praise', 'question', 'unknown'],
      default: 'unknown',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'clustered', 'resolved', 'ignored'],
      default: 'pending',
      index: true,
    },
    cluster_id: {
      type: Schema.Types.ObjectId,
      ref: 'Cluster',
      index: true,
    },
    keywords: {
      type: [String],
      default: [],
      index: true,
    },
    sentiment_score: {
      type: Number,
      min: -1,
      max: 1,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'feedback_items',
  }
);

// ===========================================
// INDEXES FOR COMMON QUERIES
// ===========================================

// Compound index for dashboard queries
FeedbackItemSchema.index({ status: 1, normalized_severity: -1 });
FeedbackItemSchema.index({ source: 1, created_at: -1 });
FeedbackItemSchema.index({ feedback_type: 1, normalized_severity: -1 });

// Text search index for content
FeedbackItemSchema.index({ content: 'text', keywords: 'text' });

// ===========================================
// PRE-SAVE HOOKS
// ===========================================

FeedbackItemSchema.pre('save', function (next) {
  // Auto-generate content preview
  if (this.content && !this.content_preview) {
    this.content_preview = this.content.substring(0, 200) + (this.content.length > 200 ? '...' : '');
  }
  next();
});

// ===========================================
// STATIC METHODS
// ===========================================

FeedbackItemSchema.statics.findPending = function () {
  return this.find({ status: 'pending' }).sort({ normalized_severity: -1 });
};

FeedbackItemSchema.statics.findCritical = function (threshold = 80) {
  return this.find({ 
    status: { $in: ['pending', 'clustered'] },
    normalized_severity: { $gte: threshold } 
  }).sort({ normalized_severity: -1 });
};

// ===========================================
// MODEL EXPORT
// ===========================================

// Prevent model recompilation in development
export const FeedbackItem: Model<IFeedbackItem> = 
  mongoose.models.FeedbackItem || mongoose.model<IFeedbackItem>('FeedbackItem', FeedbackItemSchema);
