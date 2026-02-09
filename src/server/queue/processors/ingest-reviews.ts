/**
 * Ingest Reviews Job Processor
 * 
 * Handles the ingest_reviews job:
 * - Fetches reviews from external sources via connectors
 * - Creates/updates reviews in database
 * - Updates connector sync status
 */

import { Job, UnrecoverableError } from 'bullmq';
import { db } from '@/server/db';
import { ConnectorStatus } from '@prisma/client';
import {
  IngestReviewsJobData,
  IngestReviewsJobResult,
  JobProgress,
  createBaseJobResult,
} from '../types';
import { logger } from '@/lib/logger';

// ============================================================
// PROCESSOR
// ============================================================

/**
 * Process an ingest_reviews job
 */
export async function processIngestReviewsJob(
  job: Job<IngestReviewsJobData, IngestReviewsJobResult>
): Promise<IngestReviewsJobResult> {
  const startTime = Date.now();
  const { tenantId, connectorId, sinceDate, forceFullSync, maxReviews } = job.data;
  
  const jobLogger = logger.child({
    jobId: job.id,
    tenantId,
    connectorId,
    correlationId: job.data.correlationId,
  });
  
  jobLogger.info('Starting ingest_reviews job');
  await job.log(`[${new Date().toISOString()}] Starting ingest job for connector ${connectorId}`);
  
  try {
    // 1. Validate connector exists and belongs to tenant
    await updateProgress(job, 'Validating connector', 5);
    
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
      include: { tenant: true },
    });
    
    if (!connector) {
      throw new UnrecoverableError(`Connector not found: ${connectorId}`);
    }
    
    if (connector.tenantId !== tenantId) {
      throw new UnrecoverableError(`Connector ${connectorId} does not belong to tenant ${tenantId}`);
    }
    
    if (!connector.isActive) {
      throw new UnrecoverableError(`Connector ${connectorId} is not active`);
    }
    
    await job.log(`[${new Date().toISOString()}] Connector validated: ${connector.name} (${connector.sourceType})`);
    
    // 2. Create ingestion run record
    await updateProgress(job, 'Creating ingestion run', 10);
    
    const ingestionRun = await db.ingestionRun.create({
      data: {
        tenantId,
        connectorId,
        status: 'RUNNING',
        runType: 'MANUAL',
        startedAt: new Date(),
      },
    });
    
    await job.log(`[${new Date().toISOString()}] Ingestion run created: ${ingestionRun.id}`);
    
    // 3. Update connector status to ACTIVE (syncing)
    await db.connector.update({
      where: { id: connectorId },
      data: {
        status: ConnectorStatus.ACTIVE,
      },
    });
    
    // 4. Determine sync date range
    await updateProgress(job, 'Determining sync range', 15);
    
    let syncSince = sinceDate ? new Date(sinceDate) : null;
    
    if (!syncSince && !forceFullSync && connector.lastSyncedAt) {
      syncSince = connector.lastSyncedAt;
    }
    
    await job.log(`[${new Date().toISOString()}] Sync range: ${syncSince ? `since ${syncSince.toISOString()}` : 'full sync'}`);
    
    // 5. Fetch reviews (placeholder - actual implementation depends on connector type)
    await updateProgress(job, 'Fetching reviews', 30);
    
    // In real implementation, this would call the connector's fetch method
    // For now, we'll simulate the process
    const fetchResult = await simulateFetchReviews(
      connectorId,
      connector.sourceType,
      syncSince,
      maxReviews,
      job
    );
    
    // 6. Process fetched reviews
    await updateProgress(job, 'Processing reviews', 60);
    
    let reviewsCreated = 0;
    let reviewsUpdated = 0;
    let reviewsSkipped = 0;
    
    for (const review of fetchResult.reviews) {
      const existing = await db.review.findFirst({
        where: {
          connectorId,
          externalReviewId: review.externalReviewId,
        },
      });
      
      if (existing) {
        // Check if content changed
        if (existing.content !== review.content || existing.rating !== review.rating) {
          await db.review.update({
            where: { id: existing.id },
            data: {
              content: review.content,
              rating: review.rating,
              responseText: review.responseText,
              responseDate: review.responseDate,
              likesCount: review.likesCount,
              repliesCount: review.repliesCount,
              helpfulCount: review.helpfulCount,
            },
          });
          reviewsUpdated++;
        } else {
          reviewsSkipped++;
        }
      } else {
        await db.review.create({
          data: {
            tenantId,
            connectorId,
            externalReviewId: review.externalReviewId,
            rating: review.rating,
            title: review.title,
            content: review.content,
            authorName: review.authorName,
            authorId: review.authorId,
            reviewDate: new Date(review.reviewDate),
            responseText: review.responseText,
            responseDate: review.responseDate ? new Date(review.responseDate) : null,
            likesCount: review.likesCount || 0,
            repliesCount: review.repliesCount || 0,
            helpfulCount: review.helpfulCount || 0,
            detectedLanguage: review.detectedLanguage,
            textLength: review.content?.length,
          },
        });
        reviewsCreated++;
      }
      
      // Update progress periodically
      const processed = reviewsCreated + reviewsUpdated + reviewsSkipped;
      if (processed % 10 === 0) {
        const percent = 60 + Math.floor((processed / fetchResult.reviews.length) * 35);
        await updateProgress(job, `Processing reviews (${processed}/${fetchResult.reviews.length})`, percent, processed, fetchResult.reviews.length);
      }
    }
    
    // 7. Update ingestion run
    await updateProgress(job, 'Finalizing', 95);
    
    await db.ingestionRun.update({
      where: { id: ingestionRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        reviewsFetched: fetchResult.reviews.length,
        reviewsCreated,
        reviewsUpdated,
        reviewsSkipped,
      },
    });
    
    // 8. Update connector status and sync time
    await db.connector.update({
      where: { id: connectorId },
      data: {
        status: ConnectorStatus.ACTIVE,
        lastSyncedAt: new Date(),
        errorMessage: null,
        errorCount: 0,
      },
    });
    
    await updateProgress(job, 'Complete', 100);
    await job.log(`[${new Date().toISOString()}] Job completed: ${reviewsCreated} created, ${reviewsUpdated} updated, ${reviewsSkipped} skipped`);
    
    jobLogger.info({
      reviewsFetched: fetchResult.reviews.length,
      reviewsCreated,
      reviewsUpdated,
      reviewsSkipped,
      durationMs: Date.now() - startTime,
    }, 'Ingest job completed');
    
    return {
      ...createBaseJobResult(true, startTime),
      reviewsFetched: fetchResult.reviews.length,
      reviewsCreated,
      reviewsUpdated,
      reviewsSkipped,
      ingestionRunId: ingestionRun.id,
      connectorId,
      sourceType: connector.sourceType,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    jobLogger.error({ error }, 'Ingest job failed');
    await job.log(`[${new Date().toISOString()}] ERROR: ${errorMessage}`);
    
    // Update connector status on failure
    await db.connector.update({
      where: { id: connectorId },
      data: {
        status: ConnectorStatus.ERROR,
        errorMessage,
        errorCount: { increment: 1 },
      },
    });
    
    throw error;
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Update job progress
 */
async function updateProgress(
  job: Job,
  step: string,
  percent: number,
  processed?: number,
  total?: number
): Promise<void> {
  const progress: JobProgress = {
    step,
    percent,
    processed,
    total,
    message: step,
  };
  await job.updateProgress(progress);
}

/**
 * Simulated review fetch (placeholder for real connector implementation)
 */
interface FetchedReview {
  externalReviewId: string;
  rating: number | null;
  title: string | null;
  content: string;
  authorName: string | null;
  authorId: string | null;
  reviewDate: string;
  responseText: string | null;
  responseDate: string | null;
  likesCount: number;
  repliesCount: number;
  helpfulCount: number;
  detectedLanguage: string | null;
}

async function simulateFetchReviews(
  connectorId: string,
  sourceType: string,
  sinceDate: Date | null,
  maxReviews: number | undefined,
  job: Job
): Promise<{ reviews: FetchedReview[] }> {
  // In a real implementation, this would call the appropriate connector
  // For now, return empty array - actual fetch happens via the ingestion service
  await job.log(`[${new Date().toISOString()}] Fetching reviews from ${sourceType} connector`);
  
  // TODO: Integrate with actual connector implementations
  // const connector = getConnectorRegistry().getConnector(sourceType);
  // return connector.fetchReviews(connectorId, sinceDate, maxReviews);
  
  return { reviews: [] };
}
