/**
 * Severity Normalization Utility
 * 
 * ===========================================================================
 * HACKATHON NOTE: This is the core weighting logic!
 * Tweak these weights to calibrate what your product considers "severe".
 * ===========================================================================
 * 
 * The goal is to map diverse metrics (1-5 stars, upvotes, etc.) to a 
 * unified 0-100 severity score where:
 * 
 *   0-30:  Low severity (nice-to-have, minor feedback)
 *   31-60: Medium severity (should address soon)
 *   61-80: High severity (prioritize this sprint)
 *   81-100: Critical severity (drop everything, this is urgent)
 * 
 * The normalization considers:
 * 1. Raw metric value (star rating, upvote count, etc.)
 * 2. Engagement multiplier (how many people are affected)
 * 3. Recency bonus (recent issues get a boost)
 * 4. Sentiment penalty (negative sentiment increases severity)
 */

import type { FeedbackSource, FeedbackMeta } from '@/lib/db/models/feedback-item';

// ===========================================================================
// CONFIGURABLE WEIGHTS - TWEAK THESE DURING HACKATHON!
// ===========================================================================

export const SEVERITY_WEIGHTS = {
  // ---------------------------------------------------------------------------
  // APP STORE / PLAY STORE REVIEWS
  // Star ratings are inverted: 1 star = high severity, 5 stars = low
  // ---------------------------------------------------------------------------
  APP_STORE: {
    // Map 1-5 stars to base severity
    STAR_TO_SEVERITY: {
      1: 95,  // 1-star = nearly critical
      2: 75,  // 2-star = high severity
      3: 50,  // 3-star = medium
      4: 25,  // 4-star = low
      5: 10,  // 5-star = praise (still track it!)
    } as Record<number, number>,

    // If no star rating provided, use this default
    DEFAULT_SEVERITY: 50,
  },

  // ---------------------------------------------------------------------------
  // PRODUCT HUNT
  // Upvotes indicate importance, but high upvotes on a complaint = BAD
  // ---------------------------------------------------------------------------
  PRODUCT_HUNT: {
    // Base severity for a Product Hunt comment (neutral)
    BASE_SEVERITY: 40,

    // Each upvote adds to severity (complaints with lots of upvotes = urgent)
    UPVOTE_WEIGHT: 0.8,  // +0.8 severity per upvote

    // Cap the upvote contribution to prevent runaway scores
    MAX_UPVOTE_CONTRIBUTION: 40,

    // If maker replied, it's being handled, reduce severity slightly
    MAKER_REPLY_REDUCTION: 10,
  },

  // ---------------------------------------------------------------------------
  // REDDIT
  // Score = upvotes - downvotes. High score + negative sentiment = critical
  // ---------------------------------------------------------------------------
  REDDIT: {
    BASE_SEVERITY: 35,

    // Reddit score contribution (log scale to handle viral posts)
    SCORE_MULTIPLIER: 8,  // Multiplied by log10(score + 1)

    // Comment count indicates engagement
    COMMENT_WEIGHT: 0.3,  // +0.3 severity per comment
    MAX_COMMENT_CONTRIBUTION: 20,

    // Subreddit-specific boosts (customize for your product's communities)
    SUBREDDIT_BOOSTS: {
      // Example: if you're building a React app
      'reactjs': 1.2,
      'webdev': 1.1,
      'programming': 1.0,
    } as Record<string, number>,
  },

  // ---------------------------------------------------------------------------
  // STACK OVERFLOW
  // High views + negative score = frustrated developers
  // ---------------------------------------------------------------------------
  STACK_OVERFLOW: {
    BASE_SEVERITY: 30,

    // Score contribution (can be negative on SO)
    SCORE_WEIGHT: 3,  // 3 points per SO score

    // View count indicates how many people have this problem
    VIEW_WEIGHT: 0.005,  // +0.5 severity per 100 views
    MAX_VIEW_CONTRIBUTION: 30,

    // Accepted answer reduces severity (problem solved)
    ACCEPTED_ANSWER_REDUCTION: 25,
  },

  // ---------------------------------------------------------------------------
  // QUORA
  // Upvotes on answers about problems indicate widespread issues
  // ---------------------------------------------------------------------------
  QUORA: {
    BASE_SEVERITY: 35,

    UPVOTE_WEIGHT: 0.5,
    MAX_UPVOTE_CONTRIBUTION: 35,

    // High follower count author = more credibility
    FOLLOWER_BOOST_THRESHOLD: 1000,
    FOLLOWER_BOOST: 10,
  },

  // ---------------------------------------------------------------------------
  // MANUAL UPLOADS (PDFs, Specs, etc.)
  // Default to medium severity, let the AI adjust during clustering
  // ---------------------------------------------------------------------------
  MANUAL_UPLOAD: {
    DEFAULT_SEVERITY: 50,
  },

  // ---------------------------------------------------------------------------
  // GLOBAL MODIFIERS
  // Applied after source-specific calculation
  // ---------------------------------------------------------------------------
  GLOBAL: {
    // Recency boost: issues reported in last 24h get a boost
    RECENCY_24H_BOOST: 10,
    RECENCY_7D_BOOST: 5,

    // Sentiment modifier (if sentiment analysis is available)
    // Very negative sentiment increases severity
    SENTIMENT_MULTIPLIER: 15,  // severity += (1 - sentiment) * 15

    // Minimum and maximum bounds
    MIN_SEVERITY: 0,
    MAX_SEVERITY: 100,
  },
};

// ===========================================================================
// KEYWORD BOOSTING
// ===========================================================================

const BASE_KEYWORD_WEIGHTS = {
  // CRITICAL (+40)
  'crash': 40,
  'panic': 40,
  'fatal': 40,
  'data loss': 40,
  'security': 40,
  'breach': 40,
  'emergency': 40,
  'critical': 30,

  // HIGH (+20)
  'error': 20,
  'exception': 20,
  'fail': 20,
  'timeout': 20,
  'slow': 15,
  'stuck': 15,
  'urgent': 20,
  'broken': 15,
  'bug': 10,

  // MEDIUM (+5)
  'issue': 5,
  'problem': 5,
  'weird': 5,
};

// ===========================================================================
// NORMALIZATION FUNCTIONS
// ===========================================================================

/**
 * Main normalization function
 * Takes source and metadata, returns a 0-100 severity score
 */
export function normalizeSeverity(
  source: FeedbackSource,
  meta: FeedbackMeta,
  options: {
    sentimentScore?: number;  // -1 to 1
    postedAt?: Date;
    content?: string; // Content for keyword analysis
  } = {}
): number {
  let severity: number;

  // Calculate base severity based on source
  switch (source) {
    case 'app_store':
      severity = normalizeAppStoreSeverity(meta);
      break;
    case 'product_hunt':
      severity = normalizeProductHuntSeverity(meta);
      break;
    case 'reddit':
      severity = normalizeRedditSeverity(meta);
      break;
    case 'stack_overflow':
      severity = normalizeStackOverflowSeverity(meta);
      break;
    case 'quora':
      severity = normalizeQuoraSeverity(meta);
      break;
    case 'manual_upload':
      severity = SEVERITY_WEIGHTS.MANUAL_UPLOAD.DEFAULT_SEVERITY;
      break;
    default:
      severity = 50; // Unknown source, default to medium
  }

  // Apply global modifiers
  severity = applyGlobalModifiers(severity, options);

  // Clamp to valid range
  return Math.round(
    Math.max(
      SEVERITY_WEIGHTS.GLOBAL.MIN_SEVERITY,
      Math.min(SEVERITY_WEIGHTS.GLOBAL.MAX_SEVERITY, severity)
    )
  );
}

// ---------------------------------------------------------------------------
// SOURCE-SPECIFIC NORMALIZERS
// ---------------------------------------------------------------------------

function normalizeAppStoreSeverity(meta: FeedbackMeta): number {
  const { star_rating } = meta;
  const weights = SEVERITY_WEIGHTS.APP_STORE;

  if (star_rating && star_rating >= 1 && star_rating <= 5) {
    return weights.STAR_TO_SEVERITY[Math.round(star_rating)];
  }

  return weights.DEFAULT_SEVERITY;
}

function normalizeProductHuntSeverity(meta: FeedbackMeta): number {
  const { upvotes = 0, maker_reply = false } = meta;
  const weights = SEVERITY_WEIGHTS.PRODUCT_HUNT;

  let severity = weights.BASE_SEVERITY;

  // Add upvote contribution
  const upvoteContribution = Math.min(
    upvotes * weights.UPVOTE_WEIGHT,
    weights.MAX_UPVOTE_CONTRIBUTION
  );
  severity += upvoteContribution;

  // Reduce if maker replied (being addressed)
  if (maker_reply) {
    severity -= weights.MAKER_REPLY_REDUCTION;
  }

  return severity;
}

function normalizeRedditSeverity(meta: FeedbackMeta): number {
  const { reddit_score = 0, comment_count = 0, subreddit } = meta;
  const weights = SEVERITY_WEIGHTS.REDDIT;

  let severity = weights.BASE_SEVERITY;

  // Log-scale score contribution (handles viral posts without exploding)
  if (reddit_score > 0) {
    severity += Math.log10(reddit_score + 1) * weights.SCORE_MULTIPLIER;
  }

  // Comment engagement contribution
  const commentContribution = Math.min(
    comment_count * weights.COMMENT_WEIGHT,
    weights.MAX_COMMENT_CONTRIBUTION
  );
  severity += commentContribution;

  // Apply subreddit boost if applicable
  if (subreddit && weights.SUBREDDIT_BOOSTS[subreddit.toLowerCase()]) {
    severity *= weights.SUBREDDIT_BOOSTS[subreddit.toLowerCase()];
  }

  return severity;
}

function normalizeStackOverflowSeverity(meta: FeedbackMeta): number {
  const { so_score = 0, view_count = 0, is_accepted = false } = meta;
  const weights = SEVERITY_WEIGHTS.STACK_OVERFLOW;

  let severity = weights.BASE_SEVERITY;

  // Score contribution (can increase or decrease)
  severity += so_score * weights.SCORE_WEIGHT;

  // View count contribution (indicates problem prevalence)
  const viewContribution = Math.min(
    view_count * weights.VIEW_WEIGHT,
    weights.MAX_VIEW_CONTRIBUTION
  );
  severity += viewContribution;

  // Reduce if there's an accepted answer
  if (is_accepted) {
    severity -= weights.ACCEPTED_ANSWER_REDUCTION;
  }

  return severity;
}

function normalizeQuoraSeverity(meta: FeedbackMeta): number {
  const { quora_upvotes = 0, follower_count = 0 } = meta;
  const weights = SEVERITY_WEIGHTS.QUORA;

  let severity = weights.BASE_SEVERITY;

  // Upvote contribution
  const upvoteContribution = Math.min(
    quora_upvotes * weights.UPVOTE_WEIGHT,
    weights.MAX_UPVOTE_CONTRIBUTION
  );
  severity += upvoteContribution;

  // High-follower author boost
  if (follower_count >= weights.FOLLOWER_BOOST_THRESHOLD) {
    severity += weights.FOLLOWER_BOOST;
  }

  return severity;
}

// ---------------------------------------------------------------------------
// GLOBAL MODIFIERS
// ---------------------------------------------------------------------------

function applyGlobalModifiers(
  baseSeverity: number,
  options: { sentimentScore?: number; postedAt?: Date }
): number {
  let severity = baseSeverity;
  const weights = SEVERITY_WEIGHTS.GLOBAL;

  // Apply recency boost
  if (options.postedAt) {
    const hoursSincePost =
      (Date.now() - new Date(options.postedAt).getTime()) / (1000 * 60 * 60);

    if (hoursSincePost <= 24) {
      severity += weights.RECENCY_24H_BOOST;
    } else if (hoursSincePost <= 168) { // 7 days
      severity += weights.RECENCY_7D_BOOST;
    }
  }

  // Apply sentiment modifier
  // sentimentScore: -1 (very negative) to 1 (very positive)
  // Very negative sentiment increases severity
  if (options.sentimentScore !== undefined) {
    // Convert sentiment to severity boost: -1 -> +15, 0 -> +7.5, 1 -> 0
    const sentimentBoost =
      (1 - options.sentimentScore) * (weights.SENTIMENT_MULTIPLIER / 2);
    severity += sentimentBoost;
  }

  // Apply keyword boosting
  if (options.content) {
    severity = applyKeywordBoost(severity, options.content);
  }

  return severity;
}

/**
 * Apply keyword-based severity boost
 */
function applyKeywordBoost(currentSeverity: number, content: string): number {
  let maxBoost = 0;
  const lowerContent = content.toLowerCase();

  // Find the highest impacting keyword present in the content
  for (const [keyword, weight] of Object.entries(BASE_KEYWORD_WEIGHTS)) {
    if (lowerContent.includes(keyword)) {
      maxBoost = Math.max(maxBoost, weight);
    }
  }

  // Apply the boost, but respect existing high severity
  // If severity is already high, the boost has diminishing returns to avoid saturating everything at 100
  return currentSeverity + maxBoost;
}

// ===========================================================================
// UTILITY FUNCTIONS
// ===========================================================================

/**
 * Get severity label for display
 */
export function getSeverityLabel(severity: number): string {
  if (severity >= 81) return 'Critical';
  if (severity >= 61) return 'High';
  if (severity >= 31) return 'Medium';
  return 'Low';
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: number): string {
  if (severity >= 81) return 'text-red-500';
  if (severity >= 61) return 'text-orange-500';
  if (severity >= 31) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Get severity background color for UI
 */
export function getSeverityBgColor(severity: number): string {
  if (severity >= 81) return 'bg-red-500/10 border-red-500/20';
  if (severity >= 61) return 'bg-orange-500/10 border-orange-500/20';
  if (severity >= 31) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-green-500/10 border-green-500/20';
}
