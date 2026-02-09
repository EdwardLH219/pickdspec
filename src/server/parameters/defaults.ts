/**
 * Default Parameter Values
 * 
 * These are the baseline parameters used when no overrides are applied.
 * Based on the Pick'd scoring algorithm specification.
 */

import type { ParameterSet, ParameterBounds } from './types';

/**
 * Default parameter set
 */
export const DEFAULT_PARAMETERS: ParameterSet = {
  sentiment: {
    model_version: 'gpt-4-turbo',
    use_star_rating: true,
    language_handling_mode: 'multilingual_model',
    star_rating_blend_weight: 0.3,
    star_sentiment_map: {
      1: -1.0,
      2: -0.5,
      3: 0.0,
      4: 0.5,
      5: 1.0,
    },
  },
  
  time: {
    review_half_life_days: 60,
  },
  
  source: {
    weights: {
      google: 1.20,
      hellopeter: 1.15,
      tripadvisor: 1.00,
      facebook: 0.90,
      yelp: 1.00,
      zomato: 1.00,
      opentable: 0.90,
      website: 0.80,
      instagram: 0.80,
      twitter: 0.70,
    },
    min_weight: 0.60,
    max_weight: 1.40,
  },
  
  engagement: {
    enabled_by_source: {
      google: true,
      facebook: true,
      tripadvisor: true,
      hellopeter: false,
      yelp: true,
      instagram: true,
      twitter: true,
      zomato: false,
      opentable: false,
      website: false,
    },
    cap: 1.30,
  },
  
  confidence: {
    rules_version: '1.0.0',
    min_text_length_chars: 20,
    duplicate_similarity_threshold: 0.85,
    low_confidence_floor: 0.60,
    vague_review_weight: 0.70,
    duplicate_review_weight: 0.60,
  },
  
  fix_tracking: {
    pre_window_days: 30,
    post_window_days: 30,
    min_reviews_for_inference: 5,
    confidence_thresholds: {
      high: 10,
      medium: 5,
      low: 2,
    },
  },
};

// ============================================================
// PARAMETER BOUNDS (for validation and clamping)
// ============================================================

/**
 * Bounds for all parameters
 * Used for validation and automatic clamping
 */
export const PARAMETER_BOUNDS: Record<string, ParameterBounds> = {
  // Sentiment
  'sentiment.model_version': { required: true },
  'sentiment.use_star_rating': { required: true },
  'sentiment.language_handling_mode': { 
    required: true,
    enum: ['detect_only', 'translate_then_score', 'multilingual_model'],
  },
  'sentiment.star_rating_blend_weight': { min: 0, max: 1 },
  
  // Time
  'time.review_half_life_days': { required: true, min: 1, max: 365 },
  
  // Source
  'source.weights.google': { min: 0.6, max: 1.4 },
  'source.weights.hellopeter': { min: 0.6, max: 1.4 },
  'source.weights.tripadvisor': { min: 0.6, max: 1.4 },
  'source.weights.facebook': { min: 0.6, max: 1.4 },
  'source.weights.yelp': { min: 0.6, max: 1.4 },
  'source.weights.zomato': { min: 0.6, max: 1.4 },
  'source.weights.opentable': { min: 0.6, max: 1.4 },
  'source.weights.website': { min: 0.6, max: 1.4 },
  'source.weights.instagram': { min: 0.6, max: 1.4 },
  'source.weights.twitter': { min: 0.6, max: 1.4 },
  'source.min_weight': { required: true, min: 0.1, max: 1.0 },
  'source.max_weight': { required: true, min: 1.0, max: 2.0 },
  
  // Engagement
  'engagement.cap': { required: true, min: 1.0, max: 2.0 },
  
  // Confidence
  'confidence.rules_version': { required: true },
  'confidence.min_text_length_chars': { required: true, min: 1, max: 500 },
  'confidence.duplicate_similarity_threshold': { required: true, min: 0.5, max: 1.0 },
  'confidence.low_confidence_floor': { required: true, min: 0, max: 1.0 },
  'confidence.vague_review_weight': { required: true, min: 0, max: 1.0 },
  'confidence.duplicate_review_weight': { required: true, min: 0, max: 1.0 },
  
  // Fix Tracking
  'fix_tracking.pre_window_days': { required: true, min: 7, max: 90 },
  'fix_tracking.post_window_days': { required: true, min: 7, max: 90 },
  'fix_tracking.min_reviews_for_inference': { required: true, min: 1, max: 50 },
  'fix_tracking.confidence_thresholds.high': { required: true, min: 1, max: 100 },
  'fix_tracking.confidence_thresholds.medium': { required: true, min: 1, max: 100 },
  'fix_tracking.confidence_thresholds.low': { required: true, min: 1, max: 100 },
};

/**
 * Required top-level keys
 */
export const REQUIRED_SECTIONS: (keyof ParameterSet)[] = [
  'sentiment',
  'time',
  'source',
  'engagement',
  'confidence',
  'fix_tracking',
];

/**
 * Required keys within each section
 */
export const REQUIRED_KEYS: Record<keyof ParameterSet, string[]> = {
  sentiment: ['model_version', 'use_star_rating', 'language_handling_mode'],
  time: ['review_half_life_days'],
  source: ['weights', 'min_weight', 'max_weight'],
  engagement: ['enabled_by_source', 'cap'],
  confidence: [
    'rules_version',
    'min_text_length_chars',
    'duplicate_similarity_threshold',
    'low_confidence_floor',
    'vague_review_weight',
    'duplicate_review_weight',
  ],
  fix_tracking: [
    'pre_window_days',
    'post_window_days',
    'min_reviews_for_inference',
    'confidence_thresholds',
  ],
};
