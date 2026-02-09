/**
 * Ingestion Framework Types
 * 
 * Core types for the review ingestion system including connector interfaces,
 * normalized review format, and ingestion tracking.
 */

import { SourceType, IngestionStatus, IngestionRunType, IngestionErrorType } from '@prisma/client';

// ============================================================
// NORMALIZED REVIEW FORMAT
// ============================================================

/**
 * Normalized review structure that all connectors must produce.
 * This is the standard format that gets stored in the database.
 */
export interface NormalizedReview {
  /** External ID from the source platform */
  externalId: string;
  
  /** Star rating (1-5, optional for platforms without ratings) */
  rating?: number;
  
  /** Review title (optional) */
  title?: string;
  
  /** Review content/body text */
  content: string;
  
  /** Author display name */
  authorName?: string;
  
  /** Author ID on the source platform */
  authorId?: string;
  
  /** When the review was originally posted */
  reviewDate: Date;
  
  /** Business response text (if any) */
  responseText?: string;
  
  /** When the business responded */
  responseDate?: Date;
  
  /** Number of likes/upvotes */
  likesCount?: number;
  
  /** Number of replies/comments */
  repliesCount?: number;
  
  /** Number of "helpful" votes */
  helpfulCount?: number;
  
  /** Detected language code (e.g., 'en', 'af') */
  detectedLanguage?: string;
  
  /** Raw data from source for debugging/audit */
  rawData?: Record<string, unknown>;
}

/**
 * Result of fetching reviews from a connector
 */
export interface FetchReviewsResult {
  /** Successfully parsed reviews */
  reviews: NormalizedReview[];
  
  /** Total reviews available (for pagination) */
  totalAvailable?: number;
  
  /** Whether there are more reviews to fetch */
  hasMore: boolean;
  
  /** Pagination cursor for next fetch */
  nextCursor?: string;
  
  /** Errors encountered during fetch */
  errors: FetchError[];
  
  /** Metadata about the fetch operation */
  metadata?: Record<string, unknown>;
}

/**
 * Error encountered during fetch operation
 */
export interface FetchError {
  type: IngestionErrorType;
  code?: string;
  message: string;
  context?: Record<string, unknown>;
  isRetryable: boolean;
}

// ============================================================
// CONNECTOR INTERFACE
// ============================================================

/**
 * Options for fetching reviews
 */
export interface FetchReviewsOptions {
  /** Fetch reviews from this date (inclusive) */
  since?: Date;
  
  /** Fetch reviews until this date (inclusive) */
  until?: Date;
  
  /** Branch/tenant ID to fetch for */
  branchId: string;
  
  /** Pagination cursor from previous fetch */
  cursor?: string;
  
  /** Maximum reviews to fetch per batch */
  limit?: number;
}

/**
 * Connector configuration (encrypted in database)
 */
export interface ConnectorConfig {
  /** OAuth tokens, API keys, etc. */
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: Date;
  };
  
  /** Source-specific settings */
  settings?: Record<string, unknown>;
  
  /** Column mappings for CSV import */
  columnMappings?: CSVColumnMapping;
}

/**
 * CSV column mapping configuration
 */
export interface CSVColumnMapping {
  externalId?: string;
  rating?: string;
  title?: string;
  content: string;
  authorName?: string;
  reviewDate: string;
  responseText?: string;
  responseDate?: string;
  
  /** Date format string (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY') */
  dateFormat?: string;
}

/**
 * Connector health/status information
 */
export interface ConnectorHealth {
  isHealthy: boolean;
  lastChecked: Date;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

/**
 * Base interface that all connectors must implement
 */
export interface IConnector {
  /** Source type this connector handles */
  readonly sourceType: SourceType;
  
  /** Human-readable name */
  readonly displayName: string;
  
  /** Whether this connector supports automatic sync */
  readonly supportsAutoSync: boolean;
  
  /** Whether this connector requires file upload */
  readonly requiresUpload: boolean;
  
  /**
   * Fetch reviews from the source
   */
  fetchReviews(options: FetchReviewsOptions): Promise<FetchReviewsResult>;
  
  /**
   * Validate connector configuration
   */
  validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }>;
  
  /**
   * Check connector health/connectivity
   */
  checkHealth(): Promise<ConnectorHealth>;
  
  /**
   * Parse uploaded file (for file-based connectors)
   */
  parseUpload?(file: Buffer, filename: string, config: ConnectorConfig): Promise<FetchReviewsResult>;
}

// ============================================================
// INGESTION TRACKING
// ============================================================

/**
 * Partial fetch options (without branchId, which is set from tenant)
 */
export interface PartialFetchOptions {
  /** Fetch reviews from this date (inclusive) */
  since?: Date;
  
  /** Fetch reviews until this date (inclusive) */
  until?: Date;
  
  /** Maximum reviews to fetch per batch */
  limit?: number;
}

/**
 * Parameters for starting an ingestion run
 */
export interface StartIngestionParams {
  tenantId: string;
  connectorId: string;
  runType: IngestionRunType;
  options?: PartialFetchOptions;
  
  /** For file uploads */
  uploadedFile?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
}

/**
 * Result of an ingestion run
 */
export interface IngestionRunResult {
  runId: string;
  status: IngestionStatus;
  
  /** Counts */
  reviewsFetched: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  reviewsSkipped: number;
  duplicatesFound: number;
  errorCount: number;
  
  /** Timing */
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  /** Errors encountered */
  errors: FetchError[];
}

/**
 * Progress update during ingestion
 */
export interface IngestionProgress {
  runId: string;
  phase: 'fetching' | 'processing' | 'saving' | 'complete';
  progress: number; // 0-100
  message: string;
  stats: {
    processed: number;
    total?: number;
    created: number;
    updated: number;
    errors: number;
  };
}

// ============================================================
// CONNECTOR REGISTRY
// ============================================================

/**
 * Connector factory function type
 */
export type ConnectorFactory = (
  connectorId: string,
  config: ConnectorConfig
) => IConnector;

/**
 * Registered connector information
 */
export interface RegisteredConnector {
  sourceType: SourceType;
  displayName: string;
  description: string;
  supportsAutoSync: boolean;
  requiresUpload: boolean;
  factory: ConnectorFactory;
}
