/**
 * Scoring Calculations
 * 
 * Implements all formulas from the Pick'd scoring specification:
 * - S_r: Base sentiment [-1, +1]
 * - W_time: Time decay (0, 1]
 * - W_source: Source weight [min, max]
 * - W_engagement: Engagement weight [1, cap]
 * - W_confidence: Confidence weight [0, 1]
 * - W_r: Weighted review impact
 */

import type { ParameterSet } from '@/server/parameters/types';
import type { SourceType } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

/**
 * Review data required for scoring
 */
export interface ReviewData {
  id: string;
  content: string;
  rating: number | null;
  reviewDate: Date;
  sourceType: SourceType;
  likesCount: number;
  repliesCount: number;
  helpfulCount: number;
  duplicateSimilarity: number | null;
  detectedLanguage: string | null;
  authorName: string | null;
}

/**
 * Base sentiment result
 */
export interface BaseSentimentResult {
  score: number;
  modelVersion: string;
  rawScore: number;
  ratingBlended: boolean;
  confidence: number;
}

/**
 * Component scores for a review
 */
export interface ReviewScoreComponents {
  baseSentiment: BaseSentimentResult;
  timeWeight: {
    value: number;
    daysDelta: number;
    halfLifeDays: number;
  };
  sourceWeight: {
    value: number;
    sourceType: string;
    rawWeight: number;
    clamped: boolean;
  };
  engagementWeight: {
    value: number;
    enabled: boolean;
    rawValue: number;
    capped: boolean;
    engagement: {
      likes: number;
      replies: number;
      helpful: number;
    };
  };
  confidenceWeight: {
    value: number;
    ruleId: string | null;
    reasonCode: string;
    matchedConditions: unknown[];
  };
  weightedImpact: number;
}

/**
 * Full review score result
 */
export interface ReviewScoreResult {
  reviewId: string;
  baseSentiment: number;
  timeWeight: number;
  sourceWeight: number;
  engagementWeight: number;
  confidenceWeight: number;
  weightedImpact: number;
  components: ReviewScoreComponents;
}

// ============================================================
// INDIVIDUAL CALCULATIONS
// ============================================================

/**
 * A.4: Calculate time weight (W_time)
 * 
 * Formula: W_time = e^(-λ × Δt) where λ = ln(2)/H
 * 
 * @param reviewDate - Date of the review
 * @param asOfDate - Reference date for calculation
 * @param halfLifeDays - Half-life parameter (H)
 * @returns Time weight in range (0, 1]
 */
export function calculateTimeWeight(
  reviewDate: Date,
  asOfDate: Date,
  halfLifeDays: number
): { value: number; daysDelta: number; halfLifeDays: number } {
  // Calculate days since review
  const daysDelta = Math.max(
    0,
    Math.floor((asOfDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  
  // λ = ln(2) / H
  const lambda = Math.log(2) / halfLifeDays;
  
  // W_time = e^(-λ × Δt)
  const value = Math.exp(-lambda * daysDelta);
  
  return {
    value: Math.max(0, Math.min(1, value)), // Ensure bounds
    daysDelta,
    halfLifeDays,
  };
}

/**
 * A.5: Calculate source weight (W_source)
 * 
 * Formula: W_source = source_weight[source], clamped to [min, max]
 * 
 * @param sourceType - Review source type
 * @param params - Parameter set with source weights
 * @returns Source weight clamped to valid range
 */
export function calculateSourceWeight(
  sourceType: SourceType,
  params: ParameterSet
): { value: number; sourceType: string; rawWeight: number; clamped: boolean } {
  const sourceKey = sourceType.toLowerCase() as Lowercase<SourceType>;
  const rawWeight = params.source.weights[sourceKey] ?? 1.0;
  
  // Clamp to [min_weight, max_weight]
  const value = Math.max(
    params.source.min_weight,
    Math.min(params.source.max_weight, rawWeight)
  );
  
  return {
    value,
    sourceType,
    rawWeight,
    clamped: value !== rawWeight,
  };
}

/**
 * A.6: Calculate engagement weight (W_engagement)
 * 
 * Formula: W_engagement = min(1 + log(1 + likes + replies + helpful), cap)
 * 
 * @param likes - Number of likes/upvotes
 * @param replies - Number of replies
 * @param helpful - Number of helpful votes
 * @param sourceType - Source type (for enabled check)
 * @param params - Parameter set with engagement settings
 * @returns Engagement weight capped at max value
 */
export function calculateEngagementWeight(
  likes: number,
  replies: number,
  helpful: number,
  sourceType: SourceType,
  params: ParameterSet
): {
  value: number;
  enabled: boolean;
  rawValue: number;
  capped: boolean;
  engagement: { likes: number; replies: number; helpful: number };
} {
  const sourceKey = sourceType.toLowerCase() as Lowercase<SourceType>;
  const enabled = params.engagement.enabled_by_source[sourceKey] ?? false;
  
  if (!enabled) {
    return {
      value: 1.0,
      enabled: false,
      rawValue: 1.0,
      capped: false,
      engagement: { likes, replies, helpful },
    };
  }
  
  // W_engagement = 1 + log(1 + likes + replies + helpful)
  const totalEngagement = likes + replies + helpful;
  const rawValue = 1 + Math.log(1 + totalEngagement);
  
  // Cap at max value
  const value = Math.min(rawValue, params.engagement.cap);
  
  return {
    value,
    enabled: true,
    rawValue,
    capped: value !== rawValue,
    engagement: { likes, replies, helpful },
  };
}

/**
 * A.8: Calculate weighted review impact (W_r)
 * 
 * Formula: W_r = S_r × W_time × W_source × W_engagement × W_confidence
 */
export function calculateWeightedImpact(
  baseSentiment: number,
  timeWeight: number,
  sourceWeight: number,
  engagementWeight: number,
  confidenceWeight: number
): number {
  return baseSentiment * timeWeight * sourceWeight * engagementWeight * confidenceWeight;
}

// ============================================================
// THEME AGGREGATION
// ============================================================

/**
 * Theme aggregation input
 */
export interface ThemeAggregationInput {
  themeId: string;
  reviewScores: Array<{
    weightedImpact: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}

/**
 * Theme aggregation result
 */
export interface ThemeAggregationResult {
  themeId: string;
  mentionCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  sumWeightedImpact: number;
  sumAbsWeightedImpact: number;
  themeSentiment: number;
  themeScore010: number;
  severity: number;
}

/**
 * B.9: Calculate theme sentiment (S_theme)
 * 
 * Formula: S_theme = ΣW_r / Σ|W_r|
 * 
 * @param weightedImpacts - Array of W_r values for reviews mentioning the theme
 * @returns Theme sentiment in range [-1, +1]
 */
export function calculateThemeSentiment(weightedImpacts: number[]): {
  sentiment: number;
  sumWr: number;
  sumAbsWr: number;
} {
  if (weightedImpacts.length === 0) {
    return { sentiment: 0, sumWr: 0, sumAbsWr: 0 };
  }
  
  const sumWr = weightedImpacts.reduce((sum, w) => sum + w, 0);
  const sumAbsWr = weightedImpacts.reduce((sum, w) => sum + Math.abs(w), 0);
  
  if (sumAbsWr === 0) {
    return { sentiment: 0, sumWr: 0, sumAbsWr: 0 };
  }
  
  const sentiment = sumWr / sumAbsWr;
  
  return {
    sentiment: Math.max(-1, Math.min(1, sentiment)), // Ensure bounds
    sumWr,
    sumAbsWr,
  };
}

/**
 * B.10: Convert theme sentiment to 0-10 scale
 * 
 * Original formula: Score_0_10 = 5 × (S_theme + 1)
 * 
 * Enhanced formula adds negative volume adjustment to bring scores
 * closer to human/AI perception. The adjustment penalizes themes
 * that have significant negative mention counts, even if the weighted
 * average is positive.
 * 
 * @param themeSentiment - S_theme in range [-1, +1]
 * @param negativeRatio - Optional: negativeCount / mentionCount (0-1)
 * @param adjustmentStrength - How much to weight the negative volume penalty (0-1, default 0.3)
 * @returns Score in range [0, 10]
 */
export function calculateThemeScore010(
  themeSentiment: number,
  negativeRatio?: number,
  adjustmentStrength: number = 0.3
): number {
  // Base score from original formula
  const baseScore = 5 * (themeSentiment + 1);
  
  // If no negative ratio provided, use original formula
  if (negativeRatio === undefined || negativeRatio === 0) {
    return Math.max(0, Math.min(10, baseScore));
  }
  
  // Apply negative volume adjustment
  // This pulls the score down when there are significant negative mentions
  // The adjustment is stronger when:
  // - negativeRatio is high (many complaints relative to total)
  // - adjustmentStrength is high (tunable parameter)
  //
  // Formula: adjustment = negativeRatio² × adjustmentStrength × (baseScore - 5)
  // - Only affects scores above 5 (penalizes inflated positive scores)
  // - Quadratic ratio makes it more sensitive to higher negative ratios
  // - Caps at bringing score to 5 (neutral), never below what sentiment suggests
  
  const scoreAboveNeutral = Math.max(0, baseScore - 5);
  const penalty = negativeRatio * negativeRatio * adjustmentStrength * scoreAboveNeutral;
  const adjustedScore = baseScore - penalty;
  
  return Math.max(0, Math.min(10, adjustedScore));
}

/**
 * B.11: Calculate severity ranking
 * 
 * Formula: Severity = |min(S_theme, 0)| × log(1 + mentions)
 * 
 * Higher severity = more negative theme with more mentions
 * 
 * @param themeSentiment - S_theme in range [-1, +1]
 * @param mentionCount - Number of reviews mentioning this theme
 * @returns Severity score (0 = not severe, higher = more severe)
 */
export function calculateSeverity(themeSentiment: number, mentionCount: number): number {
  // Only negative sentiments contribute to severity
  const negativePart = Math.abs(Math.min(themeSentiment, 0));
  
  // Scale by log of mention count
  const severity = negativePart * Math.log(1 + mentionCount);
  
  return Math.max(0, severity);
}

/**
 * Aggregate theme scores from review scores
 * 
 * @param input - Theme aggregation input with review scores
 * @param negativeAdjustmentStrength - How much to weight negative volume (0-1, default 0.3)
 */
export function aggregateThemeScores(
  input: ThemeAggregationInput,
  negativeAdjustmentStrength: number = 0.6
): ThemeAggregationResult {
  const { themeId, reviewScores } = input;
  
  // Count sentiments
  const mentionCount = reviewScores.length;
  const positiveCount = reviewScores.filter(r => r.sentiment === 'positive').length;
  const neutralCount = reviewScores.filter(r => r.sentiment === 'neutral').length;
  const negativeCount = reviewScores.filter(r => r.sentiment === 'negative').length;
  
  // Calculate negative ratio for volume adjustment
  const negativeRatio = mentionCount > 0 ? negativeCount / mentionCount : 0;
  
  // Calculate theme sentiment
  const weightedImpacts = reviewScores.map(r => r.weightedImpact);
  const { sentiment: themeSentiment, sumWr, sumAbsWr } = calculateThemeSentiment(weightedImpacts);
  
  // Calculate derived scores with negative volume adjustment
  const themeScore010 = calculateThemeScore010(themeSentiment, negativeRatio, negativeAdjustmentStrength);
  const severity = calculateSeverity(themeSentiment, mentionCount);
  
  return {
    themeId,
    mentionCount,
    positiveCount,
    neutralCount,
    negativeCount,
    sumWeightedImpact: sumWr,
    sumAbsWeightedImpact: sumAbsWr,
    themeSentiment,
    themeScore010,
    severity,
  };
}

// ============================================================
// BOUNDS VALIDATION
// ============================================================

/**
 * Validate that a score is within expected bounds
 */
export function validateBounds(
  value: number,
  min: number,
  max: number,
  name: string
): { valid: boolean; value: number; error?: string } {
  if (value < min || value > max) {
    return {
      valid: false,
      value: Math.max(min, Math.min(max, value)),
      error: `${name} out of bounds: ${value} (expected [${min}, ${max}])`,
    };
  }
  return { valid: true, value };
}

/**
 * Score bounds definitions
 */
export const SCORE_BOUNDS = {
  baseSentiment: { min: -1, max: 1 },
  timeWeight: { min: 0, max: 1 },
  sourceWeight: { min: 0.6, max: 1.4 }, // Default, can be overridden by params
  engagementWeight: { min: 1, max: 2 }, // min is 1, max is cap from params
  confidenceWeight: { min: 0, max: 1 },
  themeSentiment: { min: -1, max: 1 },
  themeScore010: { min: 0, max: 10 },
  severity: { min: 0, max: Infinity },
} as const;
