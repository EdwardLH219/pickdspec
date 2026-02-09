/**
 * Ingestion Service
 * 
 * Core service for managing review data ingestion.
 * Handles connector orchestration, run tracking, and data persistence.
 */

import { db } from '@/server/db';
import {
  IngestionStatus,
  IngestionRunType,
  IngestionErrorType,
  SourceType,
} from '@prisma/client';
import { createConnector, getConnectorInfo } from './connector-registry';
import { encrypt, decrypt, decryptJSON, isEncrypted } from './encryption';
import type {
  StartIngestionParams,
  IngestionRunResult,
  FetchReviewsOptions,
  NormalizedReview,
  FetchError,
  ConnectorConfig,
} from './types';
import { logger } from '@/lib/logger';

// Import connectors to register them
import './connectors/csv-connector';
import './connectors/google-connector';

// ============================================================
// INGESTION SERVICE
// ============================================================

/**
 * Start a new ingestion run
 */
export async function startIngestion(
  params: StartIngestionParams
): Promise<IngestionRunResult> {
  const startTime = Date.now();
  
  // Get connector from database
  const connector = await db.connector.findUnique({
    where: { id: params.connectorId },
    include: { tenant: true },
  });
  
  if (!connector) {
    throw new Error(`Connector not found: ${params.connectorId}`);
  }
  
  if (connector.tenantId !== params.tenantId) {
    throw new Error('Connector does not belong to specified tenant');
  }
  
  // Create ingestion run record
  const ingestionRun = await db.ingestionRun.create({
    data: {
      tenantId: params.tenantId,
      connectorId: params.connectorId,
      runType: params.runType,
      status: IngestionStatus.RUNNING,
      startedAt: new Date(),
    },
  });
  
  logger.info({
    runId: ingestionRun.id,
    connectorId: params.connectorId,
    tenantId: params.tenantId,
    runType: params.runType,
  }, 'Starting ingestion run');
  
  const result: IngestionRunResult = {
    runId: ingestionRun.id,
    status: IngestionStatus.RUNNING,
    reviewsFetched: 0,
    reviewsCreated: 0,
    reviewsUpdated: 0,
    reviewsSkipped: 0,
    duplicatesFound: 0,
    errorCount: 0,
    errors: [],
    startedAt: ingestionRun.startedAt!,
  };
  
  try {
    // Get connector configuration
    let config: ConnectorConfig = {};
    if (connector.externalConfig) {
      const configStr = connector.externalConfig as string;
      if (isEncrypted(configStr)) {
        config = decryptJSON<ConnectorConfig>(configStr);
      } else if (typeof connector.externalConfig === 'object') {
        config = connector.externalConfig as ConnectorConfig;
      }
    }
    
    // Create connector instance
    const connectorInstance = createConnector(
      connector.sourceType,
      connector.id,
      config
    );
    
    // Fetch reviews
    let fetchResult;
    
    if (params.uploadedFile && connectorInstance.parseUpload) {
      // Handle file upload
      fetchResult = await connectorInstance.parseUpload(
        params.uploadedFile.buffer,
        params.uploadedFile.filename,
        config
      );
    } else {
      // Fetch from source
      const fetchOptions: FetchReviewsOptions = {
        branchId: params.tenantId,
        since: params.options?.since,
        until: params.options?.until,
        limit: params.options?.limit,
      };
      
      fetchResult = await connectorInstance.fetchReviews(fetchOptions);
    }
    
    result.reviewsFetched = fetchResult.reviews.length;
    result.errors = [...fetchResult.errors];
    result.errorCount = fetchResult.errors.length;
    
    logger.info({
      runId: ingestionRun.id,
      reviewsFetched: result.reviewsFetched,
      errorCount: result.errorCount,
    }, 'Fetched reviews, processing...');
    
    // Process and save reviews
    if (fetchResult.reviews.length > 0) {
      const processResult = await processReviews(
        fetchResult.reviews,
        connector.id,
        params.tenantId,
        ingestionRun.id
      );
      
      result.reviewsCreated = processResult.created;
      result.reviewsUpdated = processResult.updated;
      result.reviewsSkipped = processResult.skipped;
      result.duplicatesFound = processResult.duplicates;
      result.errors.push(...processResult.errors);
      result.errorCount = result.errors.length;
    }
    
    // Update status based on results
    if (result.errorCount > 0 && result.reviewsCreated === 0 && result.reviewsUpdated === 0) {
      result.status = IngestionStatus.FAILED;
    } else if (result.errorCount > 0) {
      result.status = IngestionStatus.PARTIAL;
    } else {
      result.status = IngestionStatus.COMPLETED;
    }
    
  } catch (error) {
    logger.error({
      runId: ingestionRun.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Ingestion run failed');
    
    result.status = IngestionStatus.FAILED;
    result.errors.push({
      type: IngestionErrorType.UNKNOWN,
      message: error instanceof Error ? error.message : 'Unknown error',
      isRetryable: true,
    });
    result.errorCount = result.errors.length;
  }
  
  // Calculate duration
  const endTime = Date.now();
  result.completedAt = new Date();
  result.durationMs = endTime - startTime;
  
  // Update ingestion run record
  await db.ingestionRun.update({
    where: { id: ingestionRun.id },
    data: {
      status: result.status,
      reviewsFetched: result.reviewsFetched,
      reviewsCreated: result.reviewsCreated,
      reviewsUpdated: result.reviewsUpdated,
      reviewsSkipped: result.reviewsSkipped,
      duplicatesFound: result.duplicatesFound,
      errorCount: result.errorCount,
      completedAt: result.completedAt,
      errorMessage: result.errors.length > 0 
        ? result.errors.map(e => e.message).join('; ')
        : null,
    },
  });
  
  // Save individual errors
  if (result.errors.length > 0) {
    await db.ingestionError.createMany({
      data: result.errors.slice(0, 100).map(error => ({ // Limit to 100 errors
        ingestionRunId: ingestionRun.id,
        errorType: error.type,
        errorCode: error.code ?? undefined,
        errorMessage: error.message,
        context: error.context ? JSON.parse(JSON.stringify(error.context)) : undefined,
        isRetryable: error.isRetryable,
      })),
    });
  }
  
  // Update connector last sync time
  await db.connector.update({
    where: { id: params.connectorId },
    data: {
      lastSyncedAt: result.completedAt,
      status: result.status === IngestionStatus.FAILED ? 'ERROR' : 'ACTIVE',
      errorMessage: result.status === IngestionStatus.FAILED 
        ? result.errors[0]?.message 
        : null,
      errorCount: result.status === IngestionStatus.FAILED 
        ? (connector.errorCount || 0) + 1 
        : 0,
    },
  });
  
  logger.info({
    runId: ingestionRun.id,
    status: result.status,
    reviewsCreated: result.reviewsCreated,
    reviewsUpdated: result.reviewsUpdated,
    durationMs: result.durationMs,
  }, 'Ingestion run completed');
  
  return result;
}

/**
 * Process and save normalized reviews to database
 */
async function processReviews(
  reviews: NormalizedReview[],
  connectorId: string,
  tenantId: string,
  ingestionRunId: string
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  errors: FetchError[];
}> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    errors: [] as FetchError[],
  };
  
  // Process in batches
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, i + BATCH_SIZE);
    
    for (const review of batch) {
      try {
        // Check for existing review
        const existing = await db.review.findUnique({
          where: {
            connectorId_externalReviewId: {
              connectorId,
              externalReviewId: review.externalId,
            },
          },
        });
        
        // Generate content hash for duplicate detection
        const contentHash = generateContentHash(review.content);
        
        // Check for duplicate content (same content from different source)
        if (!existing) {
          const duplicateCheck = await db.review.findFirst({
            where: {
              tenantId,
              contentHash,
              connectorId: { not: connectorId },
            },
          });
          
          if (duplicateCheck) {
            result.duplicates++;
            result.skipped++;
            continue;
          }
        }
        
        const reviewData = {
          tenantId,
          connectorId,
          externalReviewId: review.externalId,
          rating: review.rating,
          title: review.title,
          content: review.content,
          authorName: review.authorName,
          authorId: review.authorId,
          reviewDate: review.reviewDate,
          responseText: review.responseText,
          responseDate: review.responseDate,
          likesCount: review.likesCount || 0,
          repliesCount: review.repliesCount || 0,
          helpfulCount: review.helpfulCount || 0,
          detectedLanguage: review.detectedLanguage || detectLanguage(review.content),
          contentHash,
          textLength: review.content.length,
          // Serialize rawData for Prisma JSON field
          rawData: review.rawData ? JSON.parse(JSON.stringify(review.rawData)) : undefined,
        };
        
        if (existing) {
          // Update existing review if content changed
          const hasChanges = 
            existing.content !== review.content ||
            existing.responseText !== review.responseText ||
            existing.rating !== review.rating;
          
          if (hasChanges) {
            await db.review.update({
              where: { id: existing.id },
              data: reviewData,
            });
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          // Create new review
          await db.review.create({
            data: reviewData,
          });
          result.created++;
        }
      } catch (error) {
        result.errors.push({
          type: IngestionErrorType.VALIDATION_ERROR,
          message: `Failed to save review ${review.externalId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          context: { reviewId: review.externalId },
          isRetryable: true,
        });
      }
    }
  }
  
  return result;
}

/**
 * Generate a content hash for duplicate detection
 */
function generateContentHash(content: string): string {
  // Normalize content: lowercase, remove extra whitespace
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500); // Use first 500 chars
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Simple language detection based on character patterns
 */
function detectLanguage(text: string): string {
  // Very basic detection - in production, use a proper library
  const hasAfrikaans = /\b(die|en|is|nie|van|vir|met|het|wat|ons)\b/i.test(text);
  if (hasAfrikaans) return 'af';
  
  return 'en'; // Default to English
}

// ============================================================
// CONNECTOR MANAGEMENT
// ============================================================

/**
 * Update connector configuration (encrypted)
 */
export async function updateConnectorConfig(
  connectorId: string,
  config: ConnectorConfig
): Promise<void> {
  const encryptedConfig = encrypt(config);
  
  await db.connector.update({
    where: { id: connectorId },
    data: {
      externalConfig: encryptedConfig,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get connector configuration (decrypted)
 */
export async function getConnectorConfig(
  connectorId: string
): Promise<ConnectorConfig | null> {
  const connector = await db.connector.findUnique({
    where: { id: connectorId },
  });
  
  if (!connector?.externalConfig) return null;
  
  const configStr = connector.externalConfig as string;
  if (isEncrypted(configStr)) {
    return decryptJSON<ConnectorConfig>(configStr);
  }
  
  return connector.externalConfig as ConnectorConfig;
}

/**
 * Get ingestion run history for a connector
 */
export async function getIngestionHistory(
  connectorId: string,
  limit = 10
): Promise<Array<{
  id: string;
  status: IngestionStatus;
  runType: IngestionRunType;
  reviewsFetched: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  errorCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
}>> {
  const runs = await db.ingestionRun.findMany({
    where: { connectorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      runType: true,
      reviewsFetched: true,
      reviewsCreated: true,
      reviewsUpdated: true,
      errorCount: true,
      startedAt: true,
      completedAt: true,
    },
  });
  
  return runs;
}

/**
 * Get errors for a specific ingestion run
 */
export async function getIngestionErrors(
  ingestionRunId: string
): Promise<Array<{
  id: string;
  errorType: IngestionErrorType;
  errorMessage: string;
  context: unknown;
  isRetryable: boolean;
}>> {
  return db.ingestionError.findMany({
    where: { ingestionRunId },
    select: {
      id: true,
      errorType: true,
      errorMessage: true,
      context: true,
      isRetryable: true,
    },
  });
}

/**
 * Check if an ingestion is currently running for a connector
 */
export async function isIngestionRunning(connectorId: string): Promise<boolean> {
  const running = await db.ingestionRun.findFirst({
    where: {
      connectorId,
      status: IngestionStatus.RUNNING,
    },
  });
  
  return !!running;
}
