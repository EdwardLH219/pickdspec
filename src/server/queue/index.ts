/**
 * Queue Module
 * 
 * Job queue system for background processing
 */

// Configuration
export {
  QUEUE_NAMES,
  getRedisOptions,
  getSharedConnection,
  closeSharedConnection,
  getIngestJobId,
  getScoreRunJobId,
} from './config';

export type { QueueName } from './config';

// Types
export type {
  BaseJobData,
  BaseJobResult,
  JobProgress,
  IngestReviewsJobData,
  IngestReviewsJobResult,
  ScoreRunJobData,
  ScoreRunJobResult,
  JobData,
  JobResult,
  JobLogEntry,
} from './types';

export {
  isIngestReviewsJobData,
  isScoreRunJobData,
  createBaseJobData,
  createBaseJobResult,
} from './types';

// Queues
export {
  getIngestReviewsQueue,
  getScoreRunQueue,
  enqueueIngestReviews,
  enqueueScoreRun,
  getJobStatus,
  getRecentJobs,
  retryJob,
  cancelJob,
  cleanOldJobs,
  closeQueues,
} from './queues';

// Workers
export {
  startWorkers,
  stopWorkers,
  areWorkersRunning,
  getWorkerStatus,
  pauseWorker,
  resumeWorker,
  runWorkerProcess,
} from './worker';
