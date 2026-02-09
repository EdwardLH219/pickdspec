/**
 * Queue Instances
 * 
 * BullMQ queue instances for each job type
 */

import { Queue, QueueEvents, JobsOptions } from 'bullmq';
import {
  QUEUE_NAMES,
  DEFAULT_QUEUE_OPTIONS,
  INGEST_REVIEWS_JOB_OPTIONS,
  SCORE_RUN_JOB_OPTIONS,
  getSharedConnection,
  getIngestJobId,
  getScoreRunJobId,
} from './config';
import type {
  IngestReviewsJobData,
  ScoreRunJobData,
  JobResult,
} from './types';
import { createBaseJobData } from './types';
import { logger } from '@/lib/logger';

// ============================================================
// QUEUE INSTANCES
// ============================================================

let ingestReviewsQueue: Queue<IngestReviewsJobData, JobResult> | null = null;
let scoreRunQueue: Queue<ScoreRunJobData, JobResult> | null = null;

/**
 * Get or create the ingest_reviews queue
 */
export function getIngestReviewsQueue(): Queue<IngestReviewsJobData, JobResult> {
  if (!ingestReviewsQueue) {
    ingestReviewsQueue = new Queue<IngestReviewsJobData, JobResult>(
      QUEUE_NAMES.INGEST_REVIEWS,
      {
        connection: getSharedConnection(),
        ...DEFAULT_QUEUE_OPTIONS,
        defaultJobOptions: {
          ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
          ...INGEST_REVIEWS_JOB_OPTIONS,
        },
      }
    );
    
    logger.info({ queue: QUEUE_NAMES.INGEST_REVIEWS }, 'Queue initialized');
  }
  return ingestReviewsQueue;
}

/**
 * Get or create the score_run queue
 */
export function getScoreRunQueue(): Queue<ScoreRunJobData, JobResult> {
  if (!scoreRunQueue) {
    scoreRunQueue = new Queue<ScoreRunJobData, JobResult>(
      QUEUE_NAMES.SCORE_RUN,
      {
        connection: getSharedConnection(),
        ...DEFAULT_QUEUE_OPTIONS,
        defaultJobOptions: {
          ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
          ...SCORE_RUN_JOB_OPTIONS,
        },
      }
    );
    
    logger.info({ queue: QUEUE_NAMES.SCORE_RUN }, 'Queue initialized');
  }
  return scoreRunQueue;
}

// ============================================================
// JOB ENQUEUEING
// ============================================================

/**
 * Enqueue an ingest_reviews job
 */
export async function enqueueIngestReviews(
  tenantId: string,
  connectorId: string,
  options?: {
    sinceDate?: Date;
    forceFullSync?: boolean;
    maxReviews?: number;
    triggeredById?: string;
    dateKey?: string;
  }
): Promise<string> {
  const queue = getIngestReviewsQueue();
  
  const jobId = getIngestJobId(tenantId, connectorId, options?.dateKey);
  
  // Check if job already exists (idempotency)
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      logger.info({ jobId, state }, 'Ingest job already exists, skipping');
      return existingJob.id!;
    }
  }
  
  const jobData: IngestReviewsJobData = {
    ...createBaseJobData(tenantId, options?.triggeredById),
    connectorId,
    sinceDate: options?.sinceDate?.toISOString(),
    forceFullSync: options?.forceFullSync,
    maxReviews: options?.maxReviews,
  };
  
  const job = await queue.add(QUEUE_NAMES.INGEST_REVIEWS, jobData, {
    jobId,
  });
  
  logger.info({
    jobId: job.id,
    tenantId,
    connectorId,
  }, 'Ingest job enqueued');
  
  return job.id!;
}

/**
 * Enqueue a score_run job
 */
export async function enqueueScoreRun(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  options?: {
    branchId?: string;
    parameterVersionId?: string;
    ruleSetVersionId?: string;
    computeFixScores?: boolean;
    fixScoresSince?: Date;
    triggeredById?: string;
  }
): Promise<string> {
  const queue = getScoreRunQueue();
  
  const jobId = getScoreRunJobId(
    tenantId,
    periodStart,
    periodEnd,
    options?.parameterVersionId
  );
  
  // Check if job already exists (idempotency)
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      logger.info({ jobId, state }, 'Score run job already exists, skipping');
      return existingJob.id!;
    }
  }
  
  const jobData: ScoreRunJobData = {
    ...createBaseJobData(tenantId, options?.triggeredById),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    branchId: options?.branchId,
    parameterVersionId: options?.parameterVersionId,
    ruleSetVersionId: options?.ruleSetVersionId,
    computeFixScores: options?.computeFixScores,
    fixScoresSince: options?.fixScoresSince?.toISOString(),
  };
  
  const job = await queue.add(QUEUE_NAMES.SCORE_RUN, jobData, {
    jobId,
  });
  
  logger.info({
    jobId: job.id,
    tenantId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  }, 'Score run job enqueued');
  
  return job.id!;
}

// ============================================================
// JOB QUERIES
// ============================================================

/**
 * Get job status
 */
export async function getJobStatus(queueName: string, jobId: string) {
  const queue = queueName === QUEUE_NAMES.INGEST_REVIEWS
    ? getIngestReviewsQueue()
    : getScoreRunQueue();
  
  const job = await queue.getJob(jobId);
  if (!job) return null;
  
  const state = await job.getState();
  const progress = job.progress;
  
  // Get logs from Redis directly (BullMQ stores logs as a list)
  const connection = getSharedConnection();
  const logKey = `bull:${queueName}:${jobId}:logs`;
  const logEntries = await connection.lrange(logKey, 0, -1);
  
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    logs: logEntries,
  };
}

/**
 * Get recent jobs for a tenant
 */
export async function getRecentJobs(
  queueName: string,
  tenantId: string,
  limit: number = 20
) {
  const queue = queueName === QUEUE_NAMES.INGEST_REVIEWS
    ? getIngestReviewsQueue()
    : getScoreRunQueue();
  
  // Get jobs from all states
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getJobs(['waiting'], 0, 100),
    queue.getJobs(['active'], 0, 100),
    queue.getJobs(['completed'], 0, 100),
    queue.getJobs(['failed'], 0, 100),
  ]);
  
  const allJobs = [...waiting, ...active, ...completed, ...failed]
    .filter(job => job.data.tenantId === tenantId)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);
  
  return Promise.all(
    allJobs.map(async (job) => ({
      id: job.id,
      name: job.name,
      state: await job.getState(),
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
    }))
  );
}

/**
 * Retry a failed job
 */
export async function retryJob(queueName: string, jobId: string): Promise<boolean> {
  const queue = queueName === QUEUE_NAMES.INGEST_REVIEWS
    ? getIngestReviewsQueue()
    : getScoreRunQueue();
  
  const job = await queue.getJob(jobId);
  if (!job) return false;
  
  await job.retry();
  logger.info({ jobId, queueName }, 'Job retried');
  return true;
}

/**
 * Cancel a job
 */
export async function cancelJob(queueName: string, jobId: string): Promise<boolean> {
  const queue = queueName === QUEUE_NAMES.INGEST_REVIEWS
    ? getIngestReviewsQueue()
    : getScoreRunQueue();
  
  const job = await queue.getJob(jobId);
  if (!job) return false;
  
  await job.remove();
  logger.info({ jobId, queueName }, 'Job cancelled');
  return true;
}

// ============================================================
// QUEUE CLEANUP
// ============================================================

/**
 * Clean up old jobs
 */
export async function cleanOldJobs(queueName: string, olderThanMs: number = 7 * 24 * 60 * 60 * 1000) {
  const queue = queueName === QUEUE_NAMES.INGEST_REVIEWS
    ? getIngestReviewsQueue()
    : getScoreRunQueue();
  
  await queue.clean(olderThanMs, 1000, 'completed');
  await queue.clean(olderThanMs, 1000, 'failed');
  
  logger.info({ queueName, olderThanMs }, 'Queue cleaned');
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  
  if (ingestReviewsQueue) {
    closePromises.push(ingestReviewsQueue.close());
  }
  if (scoreRunQueue) {
    closePromises.push(scoreRunQueue.close());
  }
  
  await Promise.all(closePromises);
  
  ingestReviewsQueue = null;
  scoreRunQueue = null;
  
  logger.info('All queues closed');
}
