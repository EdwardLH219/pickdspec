# Worker Process Setup

This document explains how to run the Pick'd worker process for background job processing.

## Architecture Overview

The worker system uses [BullMQ](https://docs.bullmq.io/) with Redis for reliable job processing.

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│    Redis    │◀────│  Worker Process │
│   (Web Server)  │     │   (Queue)   │     │  (Job Processor)│
└─────────────────┘     └─────────────┘     └─────────────────┘
        │                                            │
        │  Enqueue Jobs                              │  Process Jobs
        ▼                                            ▼
   ┌─────────────┐                          ┌─────────────────┐
   │  Database   │◀─────────────────────────│   Update State  │
   │  (Postgres) │                          │   Store Results │
   └─────────────┘                          └─────────────────┘
```

## Job Types

### 1. `ingest_reviews`
Fetches reviews from external sources (Google, Hellopeter, etc.)

**Payload:**
```typescript
{
  tenantId: string;
  connectorId: string;
  sinceDate?: string;      // Optional: Only sync after this date
  forceFullSync?: boolean; // Optional: Ignore lastSyncedAt
  maxReviews?: number;     // Optional: Limit reviews fetched
}
```

**Retry Strategy:**
- 5 attempts with exponential backoff (2s, 4s, 8s, 16s, 32s)
- Failed jobs kept for 14 days

### 2. `score_run`
Scores all reviews and aggregates theme scores for a period.

**Payload:**
```typescript
{
  tenantId: string;
  periodStart: string;          // ISO date
  periodEnd: string;            // ISO date
  parameterVersionId?: string;  // Optional: Use specific version
  ruleSetVersionId?: string;    // Optional: Use specific rules
  computeFixScores?: boolean;   // Optional: Also compute FixScores
  fixScoresSince?: string;      // Optional: FixScore task date range
}
```

**Retry Strategy:**
- 3 attempts with exponential backoff (5s, 10s, 20s)
- Failed jobs kept for 30 days

## Local Development Setup

### Prerequisites

1. **Redis** - Required for job queue
   
   Using Docker (recommended):
   ```bash
   docker run -d --name pickd-redis -p 6379:6379 redis:7-alpine
   ```
   
   Or install locally:
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu
   sudo apt install redis-server
   sudo systemctl start redis
   ```

2. **Environment Variables**
   
   Add to `.env.local`:
   ```env
   # Redis connection
   REDIS_URL=redis://localhost:6379
   
   # Or individual settings
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=       # Optional
   REDIS_DB=0            # Optional, defaults to 0
   ```

### Running the Application

#### Option 1: Run Web and Worker Together (Recommended for Dev)

```bash
npm run dev:all
```

This starts both:
- Next.js dev server on http://localhost:3000
- Worker process watching for jobs

#### Option 2: Run Separately

**Terminal 1 - Web Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run dev:worker
```

The worker uses `tsx watch` which auto-reloads on file changes.

### Production

**Web Server:**
```bash
npm run build
npm start
```

**Worker Process:**
```bash
npm run start:worker
```

For production, run multiple worker instances for high availability:
```bash
# Instance 1
WORKER_ID=1 npm run start:worker

# Instance 2
WORKER_ID=2 npm run start:worker
```

## Monitoring & Debugging

### View Job Status

Jobs are stored in Redis with the following structure:
- `bull:ingest_reviews:*` - Ingest job data
- `bull:score_run:*` - Score run job data

### Job Logs

Each job includes detailed logs accessible via the BullMQ API:

```typescript
import { getJobStatus } from '@/server/queue';

const status = await getJobStatus('ingest_reviews', jobId);
console.log(status.logs); // Array of log entries
```

### BullMQ Dashboard (Optional)

For a visual dashboard, you can use [Bull Board](https://github.com/felixmosh/bull-board):

```bash
npm install @bull-board/express @bull-board/api
```

Or use the standalone [Arena](https://github.com/bee-queue/arena) dashboard.

## API Usage

### Enqueue Jobs

```typescript
import { enqueueIngestReviews, enqueueScoreRun } from '@/server/queue';

// Enqueue ingest job
const jobId1 = await enqueueIngestReviews(
  'tenant-123',
  'connector-456',
  {
    sinceDate: new Date('2024-01-01'),
    triggeredById: 'user-789',
  }
);

// Enqueue score run
const jobId2 = await enqueueScoreRun(
  'tenant-123',
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  {
    computeFixScores: true,
    triggeredById: 'user-789',
  }
);
```

### Query Job Status

```typescript
import { getJobStatus, getRecentJobs } from '@/server/queue';

// Get specific job
const status = await getJobStatus('score_run', jobId);

// Get recent jobs for tenant
const jobs = await getRecentJobs('ingest_reviews', 'tenant-123', 20);
```

### Retry/Cancel Jobs

```typescript
import { retryJob, cancelJob } from '@/server/queue';

await retryJob('score_run', jobId);  // Retry failed job
await cancelJob('ingest_reviews', jobId);  // Cancel pending job
```

## Idempotency

Jobs are idempotent by design. Each job has a deterministic ID based on:

- **Ingest jobs:** `ingest:{tenantId}:{connectorId}:{date}`
- **Score runs:** `score:{tenantId}:{periodStart}:{periodEnd}:{paramVersionId}`

If you try to enqueue a job with the same ID while one is already running/waiting, the existing job ID is returned instead of creating a duplicate.

## Error Handling

### Automatic Retries

Jobs automatically retry with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: After 2-5 seconds
Attempt 3: After 4-10 seconds
Attempt 4: After 8-20 seconds
Attempt 5: After 16-40 seconds (ingest only)
```

### Unrecoverable Errors

Certain errors should not be retried (invalid tenant, missing connector). Throw `UnrecoverableError` to fail immediately:

```typescript
import { UnrecoverableError } from 'bullmq';

if (!connector) {
  throw new UnrecoverableError('Connector not found');
}
```

### Failed Job Investigation

```typescript
const status = await getJobStatus('score_run', jobId);

if (status.state === 'failed') {
  console.log('Failure reason:', status.failedReason);
  console.log('Attempts made:', status.attemptsMade);
  console.log('Logs:', status.logs);
}
```

## Scaling Considerations

### Concurrency

Default concurrency settings:
- Ingest jobs: 3 concurrent (to respect API rate limits)
- Score runs: 2 concurrent (resource-intensive)

Adjust in `src/server/queue/worker.ts` as needed.

### Rate Limiting

Global rate limit: 10 jobs/second across all workers.

Configure per-queue limits in `src/server/queue/config.ts`.

### Redis Persistence

For production, ensure Redis is configured with persistence (RDB or AOF) to prevent job loss on restart.

## Troubleshooting

### "ECONNREFUSED" Error
Redis is not running. Start it with `docker start pickd-redis` or `brew services start redis`.

### Jobs Stuck in "waiting"
Worker process is not running. Start with `npm run dev:worker`.

### Jobs Keep Failing
Check the job logs:
```typescript
const status = await getJobStatus(queueName, jobId);
console.log(status.logs);
console.log(status.failedReason);
```

### High Memory Usage
Clean old completed/failed jobs:
```typescript
import { cleanOldJobs } from '@/server/queue';
await cleanOldJobs('ingest_reviews', 24 * 60 * 60 * 1000); // Keep 24h
await cleanOldJobs('score_run', 24 * 60 * 60 * 1000);
```
