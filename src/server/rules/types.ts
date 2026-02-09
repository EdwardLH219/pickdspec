/**
 * Rules Engine Types
 * 
 * JSON DSL for defining scoring rules:
 * - Confidence rules (review-level W_confidence)
 * - Sufficiency rules (FixScore confidence/insufficient_data)
 */

// ============================================================
// BASE RULE TYPES
// ============================================================

/**
 * Rule categories
 */
export enum RuleCategory {
  /** Review-level confidence weight rules */
  CONFIDENCE = 'confidence',
  
  /** FixScore sufficiency/data availability rules */
  SUFFICIENCY = 'sufficiency',
}

/**
 * Comparison operators for conditions
 */
export type ComparisonOperator = 
  | 'eq'      // equals
  | 'neq'     // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'in'      // value in array
  | 'nin'     // value not in array
  | 'contains'    // string contains
  | 'startsWith'  // string starts with
  | 'endsWith'    // string ends with
  | 'matches';    // regex match

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'and' | 'or' | 'not';

/**
 * Single condition in a rule
 */
export interface RuleCondition {
  /** Field path to evaluate (e.g., "review.content.length", "review.duplicateSimilarity") */
  field: string;
  
  /** Comparison operator */
  operator: ComparisonOperator;
  
  /** Value to compare against */
  value: unknown;
}

/**
 * Compound condition combining multiple conditions
 */
export interface CompoundCondition {
  /** Logical operator */
  logic: LogicalOperator;
  
  /** Child conditions */
  conditions: Array<RuleCondition | CompoundCondition>;
}

/**
 * Base rule structure
 */
export interface BaseRule {
  /** Unique rule identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what this rule does */
  description?: string;
  
  /** Rule category */
  category: RuleCategory;
  
  /** Whether rule is enabled */
  enabled: boolean;
  
  /** Priority (higher = evaluated first, first match wins for some rule types) */
  priority: number;
  
  /** Conditions to match */
  conditions: RuleCondition | CompoundCondition;
}

// ============================================================
// CONFIDENCE RULES (W_confidence)
// ============================================================

/**
 * Reason codes for confidence adjustments
 */
export enum ConfidenceReasonCode {
  /** Review text is too short/vague */
  VAGUE_REVIEW = 'VAGUE_REVIEW',
  
  /** Review is a suspected duplicate */
  DUPLICATE_SUSPECTED = 'DUPLICATE_SUSPECTED',
  
  /** Review is a confirmed duplicate */
  DUPLICATE_CONFIRMED = 'DUPLICATE_CONFIRMED',
  
  /** Review language detection failed */
  LANGUAGE_UNCERTAIN = 'LANGUAGE_UNCERTAIN',
  
  /** Review has mixed sentiment signals */
  MIXED_SIGNALS = 'MIXED_SIGNALS',
  
  /** Review is from unverified source */
  UNVERIFIED_SOURCE = 'UNVERIFIED_SOURCE',
  
  /** Review author has suspicious patterns */
  SUSPICIOUS_AUTHOR = 'SUSPICIOUS_AUTHOR',
  
  /** Review content looks templated/generic */
  TEMPLATED_CONTENT = 'TEMPLATED_CONTENT',
  
  /** Review has spam indicators */
  SPAM_INDICATORS = 'SPAM_INDICATORS',
  
  /** Full confidence - no issues found */
  FULL_CONFIDENCE = 'FULL_CONFIDENCE',
  
  /** Custom reason from rule */
  CUSTOM = 'CUSTOM',
}

/**
 * Confidence rule - determines W_confidence for a review
 */
export interface ConfidenceRule extends BaseRule {
  category: RuleCategory.CONFIDENCE;
  
  /** Action to take when rule matches */
  action: {
    /** Weight to apply (0-1, replaces default) */
    weight: number;
    
    /** Reason code for explain payload */
    reasonCode: ConfidenceReasonCode;
    
    /** Human-readable reason message */
    reasonMessage?: string;
  };
}

// ============================================================
// SUFFICIENCY RULES (FixScore confidence)
// ============================================================

/**
 * Confidence levels for FixScore
 */
export enum SufficiencyLevel {
  /** Not enough data for any inference */
  INSUFFICIENT = 'INSUFFICIENT',
  
  /** Minimal data, low confidence */
  LOW = 'LOW',
  
  /** Adequate data, moderate confidence */
  MEDIUM = 'MEDIUM',
  
  /** Strong data, high confidence */
  HIGH = 'HIGH',
}

/**
 * Reason codes for sufficiency determination
 */
export enum SufficiencyReasonCode {
  /** Not enough reviews in measurement period */
  INSUFFICIENT_REVIEWS = 'INSUFFICIENT_REVIEWS',
  
  /** Pre-period has no data */
  NO_BASELINE = 'NO_BASELINE',
  
  /** Post-period has no data */
  NO_POST_DATA = 'NO_POST_DATA',
  
  /** Measurement window too short */
  WINDOW_TOO_SHORT = 'WINDOW_TOO_SHORT',
  
  /** Review count dropped significantly */
  REVIEW_COUNT_DROP = 'REVIEW_COUNT_DROP',
  
  /** High variance in scores */
  HIGH_VARIANCE = 'HIGH_VARIANCE',
  
  /** Confounding factors detected */
  CONFOUNDING_FACTORS = 'CONFOUNDING_FACTORS',
  
  /** Sufficient data for high confidence */
  SUFFICIENT_DATA = 'SUFFICIENT_DATA',
  
  /** Custom reason from rule */
  CUSTOM = 'CUSTOM',
}

/**
 * Sufficiency rule - determines FixScore confidence level
 */
export interface SufficiencyRule extends BaseRule {
  category: RuleCategory.SUFFICIENCY;
  
  /** Action to take when rule matches */
  action: {
    /** Sufficiency level to assign */
    level: SufficiencyLevel;
    
    /** Numeric confidence value (0-1) */
    confidence: number;
    
    /** Reason code for explain payload */
    reasonCode: SufficiencyReasonCode;
    
    /** Human-readable reason message */
    reasonMessage?: string;
  };
}

// ============================================================
// RULE SET
// ============================================================

/**
 * Rule type union
 */
export type Rule = ConfidenceRule | SufficiencyRule;

/**
 * Complete rule set structure stored in DB
 */
export interface RuleSet {
  /** Rule set version */
  version: string;
  
  /** Confidence rules for W_confidence calculation */
  confidenceRules: ConfidenceRule[];
  
  /** Sufficiency rules for FixScore confidence */
  sufficiencyRules: SufficiencyRule[];
  
  /** Default confidence weight if no rules match */
  defaultConfidenceWeight: number;
  
  /** Default sufficiency level if no rules match */
  defaultSufficiency: {
    level: SufficiencyLevel;
    confidence: number;
  };
}

// ============================================================
// EXECUTION RESULT
// ============================================================

/**
 * Rule match info for explain payload
 */
export interface RuleMatch {
  /** Rule ID that matched */
  ruleId: string;
  
  /** Rule name */
  ruleName: string;
  
  /** Reason code */
  reasonCode: string;
  
  /** Human-readable explanation */
  reason: string;
  
  /** Conditions that matched */
  matchedConditions: Array<{
    field: string;
    operator: ComparisonOperator;
    expected: unknown;
    actual: unknown;
  }>;
}

/**
 * Confidence rule execution result
 */
export interface ConfidenceResult {
  /** Numeric confidence weight (0-1) */
  score: number;
  
  /** Explain payload */
  explain: {
    /** Which rules were evaluated */
    rulesEvaluated: number;
    
    /** Rules that matched (in priority order) */
    matches: RuleMatch[];
    
    /** The winning rule (first match) */
    appliedRule: RuleMatch | null;
    
    /** Whether default was used */
    usedDefault: boolean;
    
    /** Final reason code */
    reasonCode: ConfidenceReasonCode;
  };
}

/**
 * Sufficiency rule execution result
 */
export interface SufficiencyResult {
  /** Numeric confidence value (0-1) */
  score: number;
  
  /** Confidence level */
  level: SufficiencyLevel;
  
  /** Explain payload */
  explain: {
    /** Which rules were evaluated */
    rulesEvaluated: number;
    
    /** Rules that matched (in priority order) */
    matches: RuleMatch[];
    
    /** The winning rule (first match) */
    appliedRule: RuleMatch | null;
    
    /** Whether default was used */
    usedDefault: boolean;
    
    /** Final reason code */
    reasonCode: SufficiencyReasonCode;
  };
}

// ============================================================
// RULE CONTEXT (input for evaluation)
// ============================================================

/**
 * Review data for confidence rule evaluation
 */
export interface ReviewContext {
  /** Review ID */
  id: string;
  
  /** Review text content */
  content: string;
  
  /** Content length in characters */
  contentLength: number;
  
  /** Star rating (1-5 or null) */
  rating: number | null;
  
  /** Source type (google, hellopeter, etc.) */
  sourceType: string;
  
  /** Author name */
  authorName: string | null;
  
  /** Detected language */
  detectedLanguage: string | null;
  
  /** Duplicate similarity score (0-1 or null) */
  duplicateSimilarity: number | null;
  
  /** Number of likes/helpful votes */
  likesCount: number;
  
  /** Number of replies */
  repliesCount: number;
  
  /** Computed sentiment score */
  sentimentScore?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * FixScore measurement data for sufficiency rule evaluation
 */
export interface FixScoreContext {
  /** Theme ID being measured */
  themeId: string;
  
  /** Task ID (if associated with a remedial action) */
  taskId: string | null;
  
  /** Number of reviews in pre-period */
  reviewCountPre: number;
  
  /** Number of reviews in post-period */
  reviewCountPost: number;
  
  /** Total reviews in measurement window */
  totalReviews: number;
  
  /** Score before (S_before) */
  scoreBefore: number | null;
  
  /** Score after (S_after) */
  scoreAfter: number | null;
  
  /** Delta S (change in score) */
  deltaS: number | null;
  
  /** Variance in pre-period scores */
  variancePre: number | null;
  
  /** Variance in post-period scores */
  variancePost: number | null;
  
  /** Pre-window days */
  preWindowDays: number;
  
  /** Post-window days */
  postWindowDays: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================
// TYPE GUARDS
// ============================================================

/**
 * Check if a condition is a compound condition
 */
export function isCompoundCondition(
  condition: RuleCondition | CompoundCondition
): condition is CompoundCondition {
  return 'logic' in condition && 'conditions' in condition;
}

/**
 * Check if a rule is a confidence rule
 */
export function isConfidenceRule(rule: Rule): rule is ConfidenceRule {
  return rule.category === RuleCategory.CONFIDENCE;
}

/**
 * Check if a rule is a sufficiency rule
 */
export function isSufficiencyRule(rule: Rule): rule is SufficiencyRule {
  return rule.category === RuleCategory.SUFFICIENCY;
}
