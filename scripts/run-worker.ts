/**
 * Worker Process Runner
 * 
 * Standalone script to run the worker process.
 * Usage: npx tsx scripts/run-worker.ts
 */

import { runWorkerProcess } from '../src/server/queue';

runWorkerProcess();
