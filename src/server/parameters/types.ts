/**
 * Parameter Engine Types
 * 
 * Defines the structure for scoring parameters with hierarchical precedence:
 * global → tenant → branch → source → theme
 */

import { SourceType } from '@prisma/client';

// ============================================================
// PARAMETER SCHEMA
// ============================================================

/**
 * Sentiment analysis parameters
 */
export interface SentimentParameters {
  /** OpenAI model version to use */
  model_version: string;
  
  /** Whether to blend star rating with text sentiment */
  use_star_rating: boolean;
  
  /** How to handle non-English reviews */
  language_handling_mode: 'detect_only' | 'translate_then_score' | 'multilingual_model';
  
  /** Weight of star rating when blending (0-1) */
  star_rating_blend_weight?: number;
  
  /** Mapping of star ratings to sentiment values */
  star_sentiment_map?: Record<number, number>;
}

/**
 * Time decay parameters
 */
export interface TimeParameters {
  /** Half-life in days for time decay (H) */
  review_half_life_days: number;
}

/**
 * Source weight parameters
 */
export interface SourceParameters {
  /** Weight per source type */
  weights: Partial<Record<Lowercase<SourceType>, number>>;
  
  /** Minimum allowed weight after clamping */
  min_weight: number;
  
  /** Maximum allowed weight after clamping */
  max_weight: number;
}

/**
 * Engagement weight parameters
 */
export interface EngagementParameters {
  /** Whether engagement is enabled per source */
  enabled_by_source: Partial<Record<Lowercase<SourceType>, boolean>>;
  
  /** Maximum engagement weight cap */
  cap: number;
}

/**
 * Confidence weight parameters
 */
export interface ConfidenceParameters {
  /** Version of confidence rules being used */
  rules_version: string;
  
  /** Minimum text length for full confidence */
  min_text_length_chars: number;
  
  /** Similarity threshold for duplicate detection */
  duplicate_similarity_threshold: number;
  
  /** Floor value for low-confidence reviews */
  low_confidence_floor: number;
  
  /** Weight applied to vague/short reviews */
  vague_review_weight: number;
  
  /** Weight applied to suspected duplicate reviews */
  duplicate_review_weight: number;
}

/**
 * Fix tracking parameters
 */
export interface FixTrackingParameters {
  /** Days before action for baseline measurement */
  pre_window_days: number;
  
  /** Days after action for comparison measurement */
  post_window_days: number;
  
  /** Minimum reviews needed for any inference */
  min_reviews_for_inference: number;
  
  /** Review count thresholds for confidence levels */
  confidence_thresholds: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Complete parameter set structure
 */
export interface ParameterSet {
  sentiment: SentimentParameters;
  time: TimeParameters;
  source: SourceParameters;
  engagement: EngagementParameters;
  confidence: ConfidenceParameters;
  fix_tracking: FixTrackingParameters;
}

// ============================================================
// PARAMETER OVERRIDES
// ============================================================

/**
 * Partial parameter set for overrides at different levels
 * Uses DeepPartial to allow overriding any nested property
 */
export type PartialParameterSet = DeepPartial<ParameterSet>;

/**
 * Deep partial type utility
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Parameter override record
 */
export interface ParameterOverride {
  /** Override scope */
  scope: OverrideScope;
  
  /** Scope ID (tenant_id, branch_id, source_type, or theme_id) */
  scopeId: string;
  
  /** Parameter overrides */
  overrides: PartialParameterSet;
  
  /** Priority within scope (higher wins) */
  priority?: number;
  
  /** Whether this override is active */
  isActive: boolean;
}

/**
 * Override scope levels in precedence order (later wins)
 */
export enum OverrideScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  BRANCH = 'branch',
  SOURCE = 'source',
  THEME = 'theme',
}

/**
 * Precedence order for override resolution (index = priority, higher index = higher priority)
 */
export const SCOPE_PRECEDENCE: OverrideScope[] = [
  OverrideScope.GLOBAL,
  OverrideScope.TENANT,
  OverrideScope.BRANCH,
  OverrideScope.SOURCE,
  OverrideScope.THEME,
];

// ============================================================
// MATERIALIZED SNAPSHOT
// ============================================================

/**
 * Context for resolving parameters
 */
export interface ParameterContext {
  /** Tenant ID (optional for global context) */
  tenantId?: string;
  
  /** Branch ID (optional) */
  branchId?: string;
  
  /** Source type (optional, for source-specific parameters) */
  sourceType?: SourceType;
  
  /** Theme ID (optional, for theme-specific parameters) */
  themeId?: string;
}

/**
 * Materialized parameter snapshot for a score run
 */
export interface ParameterSnapshot {
  /** Unique ID for this snapshot */
  snapshotId: string;
  
  /** Base parameter set version ID */
  baseVersionId: string;
  
  /** IDs of all override records applied */
  appliedOverrideIds: string[];
  
  /** Fully resolved parameters */
  parameters: ParameterSet;
  
  /** Resolution context used */
  context: ParameterContext;
  
  /** When this snapshot was created */
  createdAt: Date;
  
  /** Resolution trace for debugging */
  resolutionTrace?: ResolutionTraceEntry[];
}

/**
 * Entry in resolution trace showing which value came from where
 */
export interface ResolutionTraceEntry {
  path: string;
  value: unknown;
  source: 'base' | 'override';
  sourceId: string;
  scope: OverrideScope;
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Parameter bounds definition
 */
export interface ParameterBounds {
  min?: number;
  max?: number;
  required?: boolean;
  enum?: unknown[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
  bounds?: ParameterBounds;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================
// CHANGELOG
// ============================================================

/**
 * Parameter version changelog entry
 */
export interface ChangelogEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
}

/**
 * Parameter version metadata
 */
export interface ParameterVersionMetadata {
  /** Version ID */
  versionId: string;
  
  /** Human-readable version name */
  name: string;
  
  /** Description of this version */
  description?: string;
  
  /** Changelog from previous version */
  changelog?: ChangelogEntry[];
  
  /** User who created this version */
  createdById: string;
  
  /** When created */
  createdAt: Date;
  
  /** Status (DRAFT, ACTIVE, ARCHIVED) */
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  
  /** When activated (if ACTIVE) */
  activatedAt?: Date;
  
  /** User who activated (if ACTIVE) */
  activatedById?: string;
}
