/**
 * Queue Job Types
 * 
 * Type definitions for all job payloads and results
 */

import { Job } from 'bullmq';

// ============================================================
// COMMON TYPES
// ============================================================

/**
 * Base job data with common fields
 */
export interface BaseJobData {
  /** Tenant ID for the job */
  tenantId: string;
  
  /** User ID who triggered the job (if manual) */
  triggeredById?: string;
  
  /** ISO timestamp when job was created */
  createdAt: string;
  
  /** Optional correlation ID for tracing */
  correlationId?: string;
}

/**
 * Base job result with common fields
 */
export interface BaseJobResult {
  /** Whether the job succeeded */
  success: boolean;
  
  /** ISO timestamp when job completed */
  completedAt: string;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Detailed error info */
  errorDetails?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Job progress update
 */
export interface JobProgress {
  /** Current step */
  step: string;
  
  /** Progress percentage (0-100) */
  percent: number;
  
  /** Items processed */
  processed?: number;
  
  /** Total items to process */
  total?: number;
  
  /** Current status message */
  message?: string;
}

// ============================================================
// INGEST REVIEWS JOB
// ============================================================

/**
 * Ingest reviews job data
 */
export interface IngestReviewsJobData extends BaseJobData {
  /** Connector ID to ingest from */
  connectorId: string;
  
  /** Optional: Only sync after this date */
  sinceDate?: string;
  
  /** Optional: Force full sync (ignore lastSyncedAt) */
  forceFullSync?: boolean;
  
  /** Optional: Maximum reviews to fetch */
  maxReviews?: number;
}

/**
 * Ingest reviews job result
 */
export interface IngestReviewsJobResult extends BaseJobResult {
  /** Number of reviews fetched */
  reviewsFetched: number;
  
  /** Number of new reviews created */
  reviewsCreated: number;
  
  /** Number of reviews updated */
  reviewsUpdated: number;
  
  /** Number of reviews skipped (duplicates) */
  reviewsSkipped: number;
  
  /** Ingestion run ID */
  ingestionRunId: string;
  
  /** Connector ID */
  connectorId: string;
  
  /** Source type */
  sourceType: string;
}

// ============================================================
// SCORE RUN JOB
// ============================================================

/**
 * Score run job data
 */
export interface ScoreRunJobData extends BaseJobData {
  /** Start of scoring period */
  periodStart: string;
  
  /** End of scoring period */
  periodEnd: string;
  
  /** Optional: Branch ID (for branch-specific scoring) */
  branchId?: string;
  
  /** Optional: Specific parameter version to use */
  parameterVersionId?: string;
  
  /** Optional: Specific rule set version to use */
  ruleSetVersionId?: string;
  
  /** Optional: Also compute FixScores for completed tasks */
  computeFixScores?: boolean;
  
  /** Optional: Date range for completed tasks to compute FixScores */
  fixScoresSince?: string;
}

/**
 * Score run job result
 */
export interface ScoreRunJobResult extends BaseJobResult {
  /** Score run ID */
  scoreRunId: string;
  
  /** Number of reviews scored */
  reviewsProcessed: number;
  
  /** Number of themes aggregated */
  themesProcessed: number;
  
  /** Number of FixScores computed */
  fixScoresComputed?: number;
  
  /** Parameter version used */
  parameterVersionId: string;
  
  /** Rule set version used */
  ruleSetVersionId: string;
  
  /** Sentiment model version used */
  sentimentModelVersion: string;
}

// ============================================================
// JOB TYPE UNION
// ============================================================

export type JobData = IngestReviewsJobData | ScoreRunJobData;
export type JobResult = IngestReviewsJobResult | ScoreRunJobResult;

// ============================================================
// JOB HELPERS
// ============================================================

/**
 * Type guard for IngestReviewsJobData
 */
export function isIngestReviewsJobData(data: JobData): data is IngestReviewsJobData {
  return 'connectorId' in data;
}

/**
 * Type guard for ScoreRunJobData
 */
export function isScoreRunJobData(data: JobData): data is ScoreRunJobData {
  return 'periodStart' in data && 'periodEnd' in data;
}

/**
 * Create base job data with defaults
 */
export function createBaseJobData(
  tenantId: string,
  triggeredById?: string
): BaseJobData {
  return {
    tenantId,
    triggeredById,
    createdAt: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
  };
}

/**
 * Create base job result
 */
export function createBaseJobResult(
  success: boolean,
  startTime: number,
  error?: Error
): BaseJobResult {
  return {
    success,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    error: error?.message,
    errorDetails: error ? {
      code: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
  };
}

// ============================================================
// JOB LOG TYPES
// ============================================================

/**
 * Job log entry
 */
export interface JobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Job with typed data
 */
export type TypedJob<T extends JobData> = Job<T, JobResult, string>;
