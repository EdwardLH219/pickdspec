/**
 * Worker Process
 * 
 * Entry point for the background job worker.
 * Processes jobs from all queues.
 */

import { Worker, Job } from 'bullmq';
import {
  QUEUE_NAMES,
  DEFAULT_WORKER_OPTIONS,
  getSharedConnection,
  closeSharedConnection,
} from './config';
import type {
  IngestReviewsJobData,
  IngestReviewsJobResult,
  ScoreRunJobData,
  ScoreRunJobResult,
} from './types';
import { processIngestReviewsJob } from './processors/ingest-reviews';
import { processScoreRunJob } from './processors/score-run';
import { logger } from '@/lib/logger';

// ============================================================
// WORKER INSTANCES
// ============================================================

let ingestWorker: Worker<IngestReviewsJobData, IngestReviewsJobResult> | null = null;
let scoreRunWorker: Worker<ScoreRunJobData, ScoreRunJobResult> | null = null;

// ============================================================
// WORKER CREATION
// ============================================================

/**
 * Create the ingest_reviews worker
 */
function createIngestReviewsWorker(): Worker<IngestReviewsJobData, IngestReviewsJobResult> {
  const worker = new Worker<IngestReviewsJobData, IngestReviewsJobResult>(
    QUEUE_NAMES.INGEST_REVIEWS,
    processIngestReviewsJob,
    {
      connection: getSharedConnection(),
      ...DEFAULT_WORKER_OPTIONS,
      concurrency: 3, // Lower concurrency for API rate limits
    }
  );
  
  setupWorkerEventHandlers(worker, QUEUE_NAMES.INGEST_REVIEWS);
  
  return worker;
}

/**
 * Create the score_run worker
 */
function createScoreRunWorker(): Worker<ScoreRunJobData, ScoreRunJobResult> {
  const worker = new Worker<ScoreRunJobData, ScoreRunJobResult>(
    QUEUE_NAMES.SCORE_RUN,
    processScoreRunJob,
    {
      connection: getSharedConnection(),
      ...DEFAULT_WORKER_OPTIONS,
      concurrency: 2, // Lower concurrency for resource-intensive jobs
    }
  );
  
  setupWorkerEventHandlers(worker, QUEUE_NAMES.SCORE_RUN);
  
  return worker;
}

/**
 * Setup common event handlers for workers
 */
function setupWorkerEventHandlers<T, R>(worker: Worker<T, R>, queueName: string): void {
  worker.on('ready', () => {
    logger.info({ queue: queueName }, 'Worker ready');
  });
  
  worker.on('active', (job: Job<T, R>) => {
    logger.info({
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    }, 'Job started');
  });
  
  worker.on('completed', (job: Job<T, R>, result: R) => {
    logger.info({
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
      durationMs: (result as { durationMs?: number }).durationMs,
    }, 'Job completed');
  });
  
  worker.on('failed', (job: Job<T, R> | undefined, error: Error) => {
    logger.error({
      queue: queueName,
      jobId: job?.id,
      jobName: job?.name,
      error: error.message,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
    }, 'Job failed');
  });
  
  worker.on('error', (error: Error) => {
    logger.error({
      queue: queueName,
      error: error.message,
    }, 'Worker error');
  });
  
  worker.on('stalled', (jobId: string) => {
    logger.warn({
      queue: queueName,
      jobId,
    }, 'Job stalled');
  });
  
  worker.on('progress', (job: Job<T, R>, progress: unknown) => {
    logger.debug({
      queue: queueName,
      jobId: job.id,
      progress,
    }, 'Job progress');
  });
}

// ============================================================
// WORKER LIFECYCLE
// ============================================================

/**
 * Start all workers
 */
export async function startWorkers(): Promise<void> {
  logger.info('Starting workers...');
  
  // Create workers
  ingestWorker = createIngestReviewsWorker();
  scoreRunWorker = createScoreRunWorker();
  
  logger.info({
    workers: [QUEUE_NAMES.INGEST_REVIEWS, QUEUE_NAMES.SCORE_RUN],
  }, 'All workers started');
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  logger.info('Stopping workers...');
  
  const closePromises: Promise<void>[] = [];
  
  if (ingestWorker) {
    closePromises.push(ingestWorker.close());
  }
  if (scoreRunWorker) {
    closePromises.push(scoreRunWorker.close());
  }
  
  await Promise.all(closePromises);
  
  ingestWorker = null;
  scoreRunWorker = null;
  
  // Close Redis connection
  await closeSharedConnection();
  
  logger.info('All workers stopped');
}

/**
 * Check if workers are running
 */
export function areWorkersRunning(): boolean {
  return ingestWorker !== null && scoreRunWorker !== null;
}

/**
 * Get worker status
 */
export async function getWorkerStatus() {
  return {
    ingestReviews: {
      running: ingestWorker !== null,
      paused: ingestWorker ? await ingestWorker.isPaused() : false,
    },
    scoreRun: {
      running: scoreRunWorker !== null,
      paused: scoreRunWorker ? await scoreRunWorker.isPaused() : false,
    },
  };
}

/**
 * Pause a specific worker
 */
export async function pauseWorker(queueName: string): Promise<void> {
  if (queueName === QUEUE_NAMES.INGEST_REVIEWS && ingestWorker) {
    await ingestWorker.pause();
    logger.info({ queue: queueName }, 'Worker paused');
  } else if (queueName === QUEUE_NAMES.SCORE_RUN && scoreRunWorker) {
    await scoreRunWorker.pause();
    logger.info({ queue: queueName }, 'Worker paused');
  }
}

/**
 * Resume a specific worker
 */
export async function resumeWorker(queueName: string): Promise<void> {
  if (queueName === QUEUE_NAMES.INGEST_REVIEWS && ingestWorker) {
    ingestWorker.resume();
    logger.info({ queue: queueName }, 'Worker resumed');
  } else if (queueName === QUEUE_NAMES.SCORE_RUN && scoreRunWorker) {
    scoreRunWorker.resume();
    logger.info({ queue: queueName }, 'Worker resumed');
  }
}

// ============================================================
// MAIN ENTRY POINT (for standalone worker process)
// ============================================================

/**
 * Run workers as standalone process
 */
export async function runWorkerProcess(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Pick\'d Worker Process Starting     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await stopWorkers();
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception in worker');
    console.error('Uncaught exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection in worker');
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });
  
  try {
    await startWorkers();
    
    console.log('');
    console.log('Workers are running. Press Ctrl+C to stop.');
    console.log('');
    console.log('Listening for jobs on queues:');
    console.log(`  • ${QUEUE_NAMES.INGEST_REVIEWS}`);
    console.log(`  • ${QUEUE_NAMES.SCORE_RUN}`);
    console.log('');
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    logger.error({ error }, 'Failed to start workers');
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}
