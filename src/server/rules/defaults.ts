/**
 * Default Rule Sets
 * 
 * Built-in confidence and sufficiency rules based on the Pick'd
 * scoring algorithm specification.
 */

import type { RuleSet, ConfidenceRule, SufficiencyRule } from './types';
import {
  RuleCategory,
  ConfidenceReasonCode,
  SufficiencyReasonCode,
  SufficiencyLevel,
} from './types';

// ============================================================
// DEFAULT CONFIDENCE RULES
// ============================================================

/**
 * Default confidence rules for W_confidence calculation
 * 
 * These rules are evaluated in priority order (descending).
 * First matching rule wins.
 */
export const DEFAULT_CONFIDENCE_RULES: ConfidenceRule[] = [
  // Highest priority: spam detection
  {
    id: 'conf-001',
    name: 'Spam Detection',
    description: 'Very short reviews with extreme ratings are likely spam',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 100,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'contentLength', operator: 'lt', value: 10 },
        { field: 'rating', operator: 'in', value: [1, 5] },
      ],
    },
    action: {
      weight: 0.3,
      reasonCode: ConfidenceReasonCode.SPAM_INDICATORS,
      reasonMessage: 'Review is very short with extreme rating, possible spam',
    },
  },
  
  // Confirmed duplicate
  {
    id: 'conf-002',
    name: 'Confirmed Duplicate',
    description: 'Review is highly similar to another review (>95%)',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 90,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'duplicateSimilarity', operator: 'gte', value: 0.95 },
      ],
    },
    action: {
      weight: 0.4,
      reasonCode: ConfidenceReasonCode.DUPLICATE_CONFIRMED,
      reasonMessage: 'Review is a confirmed duplicate (>95% similarity)',
    },
  },
  
  // Suspected duplicate
  {
    id: 'conf-003',
    name: 'Suspected Duplicate',
    description: 'Review is similar to another review (>85%)',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 80,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'duplicateSimilarity', operator: 'gte', value: 0.85 },
        { field: 'duplicateSimilarity', operator: 'lt', value: 0.95 },
      ],
    },
    action: {
      weight: 0.6,
      reasonCode: ConfidenceReasonCode.DUPLICATE_SUSPECTED,
      reasonMessage: 'Review may be a duplicate (>85% similarity)',
    },
  },
  
  // Vague/short review
  {
    id: 'conf-004',
    name: 'Vague Review',
    description: 'Review text is too short to be meaningful',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 70,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'contentLength', operator: 'lt', value: 20 },
      ],
    },
    action: {
      weight: 0.7,
      reasonCode: ConfidenceReasonCode.VAGUE_REVIEW,
      reasonMessage: 'Review is too short/vague for reliable analysis',
    },
  },
  
  // Templated content
  {
    id: 'conf-005',
    name: 'Templated Content',
    description: 'Review appears to be templated or generic',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 60,
    conditions: {
      logic: 'or',
      conditions: [
        { field: 'content', operator: 'matches', value: '^(good|bad|ok|okay|nice|great|terrible|awful|amazing|excellent)[\\.\\!]?$' },
        { field: 'content', operator: 'matches', value: '^\\d+ stars?[\\.\\!]?$' },
      ],
    },
    action: {
      weight: 0.65,
      reasonCode: ConfidenceReasonCode.TEMPLATED_CONTENT,
      reasonMessage: 'Review appears to be generic/templated',
    },
  },
  
  // Mixed signals (rating vs content mismatch)
  {
    id: 'conf-006',
    name: 'Mixed Signals - High Rating, Negative Words',
    description: 'High star rating but content contains negative language',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 50,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'rating', operator: 'gte', value: 4 },
        { field: 'content', operator: 'matches', value: '(terrible|awful|horrible|worst|never again|disgusting|disappointed|hate)' },
      ],
    },
    action: {
      weight: 0.75,
      reasonCode: ConfidenceReasonCode.MIXED_SIGNALS,
      reasonMessage: 'Rating and content sentiment appear to conflict',
    },
  },
  
  // Mixed signals - Low rating with positive words
  {
    id: 'conf-007',
    name: 'Mixed Signals - Low Rating, Positive Words',
    description: 'Low star rating but content is positive',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 50,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'rating', operator: 'lte', value: 2 },
        { field: 'content', operator: 'matches', value: '(excellent|amazing|fantastic|perfect|best|love|wonderful|outstanding)' },
      ],
    },
    action: {
      weight: 0.75,
      reasonCode: ConfidenceReasonCode.MIXED_SIGNALS,
      reasonMessage: 'Rating and content sentiment appear to conflict',
    },
  },
  
  // Unverified source (website/self-reported)
  {
    id: 'conf-008',
    name: 'Unverified Source',
    description: 'Review is from an unverified source',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 40,
    conditions: {
      logic: 'or',
      conditions: [
        { field: 'sourceType', operator: 'eq', value: 'website' },
        { field: 'sourceType', operator: 'eq', value: 'WEBSITE' },
      ],
    },
    action: {
      weight: 0.85,
      reasonCode: ConfidenceReasonCode.UNVERIFIED_SOURCE,
      reasonMessage: 'Review source cannot be independently verified',
    },
  },
  
  // Language detection failed
  {
    id: 'conf-009',
    name: 'Language Uncertain',
    description: 'Unable to detect review language',
    category: RuleCategory.CONFIDENCE,
    enabled: true,
    priority: 30,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'detectedLanguage', operator: 'eq', value: null },
        { field: 'contentLength', operator: 'gte', value: 20 },
      ],
    },
    action: {
      weight: 0.9,
      reasonCode: ConfidenceReasonCode.LANGUAGE_UNCERTAIN,
      reasonMessage: 'Review language could not be determined',
    },
  },
];

// ============================================================
// DEFAULT SUFFICIENCY RULES
// ============================================================

/**
 * Default sufficiency rules for FixScore confidence
 * 
 * These rules determine how confident we are in FixScore calculations
 * based on available data.
 */
export const DEFAULT_SUFFICIENCY_RULES: SufficiencyRule[] = [
  // Highest priority: No baseline data
  {
    id: 'suff-001',
    name: 'No Baseline Data',
    description: 'No reviews in pre-period for comparison',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 100,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'reviewCountPre', operator: 'eq', value: 0 },
      ],
    },
    action: {
      level: SufficiencyLevel.INSUFFICIENT,
      confidence: 0,
      reasonCode: SufficiencyReasonCode.NO_BASELINE,
      reasonMessage: 'Cannot calculate FixScore without baseline data',
    },
  },
  
  // No post data
  {
    id: 'suff-002',
    name: 'No Post Data',
    description: 'No reviews in post-period',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 95,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'reviewCountPost', operator: 'eq', value: 0 },
      ],
    },
    action: {
      level: SufficiencyLevel.INSUFFICIENT,
      confidence: 0,
      reasonCode: SufficiencyReasonCode.NO_POST_DATA,
      reasonMessage: 'Cannot calculate FixScore without post-action data',
    },
  },
  
  // Insufficient total reviews
  {
    id: 'suff-003',
    name: 'Insufficient Reviews',
    description: 'Not enough reviews for reliable inference',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 90,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'totalReviews', operator: 'lt', value: 2 },
      ],
    },
    action: {
      level: SufficiencyLevel.INSUFFICIENT,
      confidence: 0,
      reasonCode: SufficiencyReasonCode.INSUFFICIENT_REVIEWS,
      reasonMessage: 'Minimum 2 reviews required for any inference',
    },
  },
  
  // Low confidence (2-4 reviews)
  {
    id: 'suff-004',
    name: 'Low Data Volume',
    description: 'Minimal data for inference (2-4 reviews)',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 70,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'totalReviews', operator: 'gte', value: 2 },
        { field: 'totalReviews', operator: 'lt', value: 5 },
      ],
    },
    action: {
      level: SufficiencyLevel.LOW,
      confidence: 0.4,
      reasonCode: SufficiencyReasonCode.INSUFFICIENT_REVIEWS,
      reasonMessage: 'Limited data available, low confidence in FixScore',
    },
  },
  
  // Medium confidence (5-9 reviews)
  {
    id: 'suff-005',
    name: 'Medium Data Volume',
    description: 'Moderate data for inference (5-9 reviews)',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 60,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'totalReviews', operator: 'gte', value: 5 },
        { field: 'totalReviews', operator: 'lt', value: 10 },
      ],
    },
    action: {
      level: SufficiencyLevel.MEDIUM,
      confidence: 0.7,
      reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
      reasonMessage: 'Moderate data available for FixScore calculation',
    },
  },
  
  // Significant review count drop
  {
    id: 'suff-006',
    name: 'Review Count Drop',
    description: 'Significant drop in review volume post-action',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 55,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'reviewCountPre', operator: 'gte', value: 5 },
        { field: 'reviewCountPost', operator: 'lt', value: 2 },
      ],
    },
    action: {
      level: SufficiencyLevel.LOW,
      confidence: 0.3,
      reasonCode: SufficiencyReasonCode.REVIEW_COUNT_DROP,
      reasonMessage: 'Significant drop in review volume may indicate confounding factors',
    },
  },
  
  // High confidence (10+ reviews)
  {
    id: 'suff-007',
    name: 'High Data Volume',
    description: 'Strong data for inference (10+ reviews)',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 50,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'totalReviews', operator: 'gte', value: 10 },
      ],
    },
    action: {
      level: SufficiencyLevel.HIGH,
      confidence: 1.0,
      reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
      reasonMessage: 'Strong data volume for reliable FixScore calculation',
    },
  },
  
  // High variance warning
  {
    id: 'suff-008',
    name: 'High Variance',
    description: 'High variance in scores reduces confidence',
    category: RuleCategory.SUFFICIENCY,
    enabled: true,
    priority: 45,
    conditions: {
      logic: 'or',
      conditions: [
        { field: 'variancePre', operator: 'gt', value: 0.5 },
        { field: 'variancePost', operator: 'gt', value: 0.5 },
      ],
    },
    action: {
      level: SufficiencyLevel.MEDIUM,
      confidence: 0.6,
      reasonCode: SufficiencyReasonCode.HIGH_VARIANCE,
      reasonMessage: 'High variance in scores reduces confidence',
    },
  },
];

// ============================================================
// DEFAULT RULE SET
// ============================================================

/**
 * Complete default rule set
 */
export const DEFAULT_RULE_SET: RuleSet = {
  version: '1.0.0',
  confidenceRules: DEFAULT_CONFIDENCE_RULES,
  sufficiencyRules: DEFAULT_SUFFICIENCY_RULES,
  defaultConfidenceWeight: 1.0,
  defaultSufficiency: {
    level: SufficiencyLevel.MEDIUM,
    confidence: 0.7,
  },
};

/**
 * Get a copy of the default rule set
 */
export function getDefaultRuleSet(): RuleSet {
  return JSON.parse(JSON.stringify(DEFAULT_RULE_SET));
}
