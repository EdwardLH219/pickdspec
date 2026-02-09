/**
 * Queue Configuration
 * 
 * Redis connection and queue settings for BullMQ
 */

import { Redis, RedisOptions } from 'ioredis';
import { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

// ============================================================
// REDIS CONNECTION
// ============================================================

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parseInt(parsed.pathname.slice(1) || '0', 10),
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

/**
 * Get Redis connection options from environment
 */
export function getRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }
  
  // Default local development settings
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

/**
 * Create a new Redis connection
 */
export function createRedisConnection(): Redis {
  const options = getRedisOptions();
  const connection = new Redis({
    ...options,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
  
  connection.on('error', (error) => {
    console.error('Redis connection error:', error);
  });
  
  connection.on('connect', () => {
    console.log('Redis connected');
  });
  
  return connection;
}

// Shared connection for queues
let sharedConnection: Redis | null = null;

export function getSharedConnection(): Redis {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

export async function closeSharedConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}

// ============================================================
// QUEUE NAMES
// ============================================================

export const QUEUE_NAMES = {
  INGEST_REVIEWS: 'ingest_reviews',
  SCORE_RUN: 'score_run',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// ============================================================
// QUEUE OPTIONS
// ============================================================

/**
 * Default queue options
 */
export const DEFAULT_QUEUE_OPTIONS: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Default worker options
 */
export const DEFAULT_WORKER_OPTIONS: Partial<WorkerOptions> = {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // Max 10 jobs per second
  },
};

// ============================================================
// JOB-SPECIFIC OPTIONS
// ============================================================

/**
 * Job options for ingest_reviews
 */
export const INGEST_REVIEWS_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 500,
  },
  removeOnFail: {
    age: 14 * 24 * 60 * 60, // Keep for 14 days
  },
};

/**
 * Job options for score_run
 */
export const SCORE_RUN_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 7 * 24 * 60 * 60, // Keep for 7 days
    count: 200,
  },
  removeOnFail: {
    age: 30 * 24 * 60 * 60, // Keep for 30 days
  },
};

// ============================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================

/**
 * Generate idempotency key for ingest_reviews job
 */
export function getIngestJobId(
  tenantId: string,
  connectorId: string,
  dateKey?: string
): string {
  const date = dateKey || new Date().toISOString().split('T')[0];
  return `ingest:${tenantId}:${connectorId}:${date}`;
}

/**
 * Generate idempotency key for score_run job
 */
export function getScoreRunJobId(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  parameterVersionId?: string
): string {
  const startKey = periodStart.toISOString().split('T')[0];
  const endKey = periodEnd.toISOString().split('T')[0];
  const paramKey = parameterVersionId || 'active';
  return `score:${tenantId}:${startKey}:${endKey}:${paramKey}`;
}
