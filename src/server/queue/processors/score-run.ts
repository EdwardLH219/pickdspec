/**
 * Score Run Job Processor
 * 
 * Handles the score_run job:
 * - Scores all reviews in the period
 * - Aggregates theme scores
 * - Optionally computes FixScores for completed tasks
 */

import { Job, UnrecoverableError } from 'bullmq';
import { db } from '@/server/db';
import {
  ScoreRunJobData,
  ScoreRunJobResult,
  JobProgress,
  createBaseJobResult,
} from '../types';
import { executeScoreRun } from '@/server/scoring/pipeline';
import { computeFixScoresForCompletedTasks } from '@/server/scoring/fixscore';
import { logger } from '@/lib/logger';

// ============================================================
// PROCESSOR
// ============================================================

/**
 * Process a score_run job
 */
export async function processScoreRunJob(
  job: Job<ScoreRunJobData, ScoreRunJobResult>
): Promise<ScoreRunJobResult> {
  const startTime = Date.now();
  const {
    tenantId,
    periodStart,
    periodEnd,
    branchId,
    parameterVersionId,
    ruleSetVersionId,
    computeFixScores,
    fixScoresSince,
    triggeredById,
  } = job.data;
  
  const jobLogger = logger.child({
    jobId: job.id,
    tenantId,
    periodStart,
    periodEnd,
    correlationId: job.data.correlationId,
  });
  
  jobLogger.info('Starting score_run job');
  await job.log(`[${new Date().toISOString()}] Starting score run for tenant ${tenantId}`);
  await job.log(`[${new Date().toISOString()}] Period: ${periodStart} to ${periodEnd}`);
  
  try {
    // 1. Validate tenant exists
    await updateProgress(job, 'Validating tenant', 5);
    
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      throw new UnrecoverableError(`Tenant not found: ${tenantId}`);
    }
    
    await job.log(`[${new Date().toISOString()}] Tenant validated: ${tenant.name}`);
    
    // 2. Validate period makes sense
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    
    if (periodStartDate >= periodEndDate) {
      throw new UnrecoverableError('Period start must be before period end');
    }
    
    const daysDiff = (periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new UnrecoverableError('Period cannot exceed 365 days');
    }
    
    await job.log(`[${new Date().toISOString()}] Period validated: ${daysDiff.toFixed(1)} days`);
    
    // 3. Check for existing score run with same parameters (idempotency check)
    await updateProgress(job, 'Checking for existing runs', 10);
    
    const existingRun = await db.scoreRun.findFirst({
      where: {
        tenantId,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        parameterVersionId: parameterVersionId || undefined,
        status: 'COMPLETED',
      },
    });
    
    if (existingRun) {
      await job.log(`[${new Date().toISOString()}] Found existing completed run: ${existingRun.id}`);
      
      // Return existing results
      return {
        ...createBaseJobResult(true, startTime),
        scoreRunId: existingRun.id,
        reviewsProcessed: existingRun.reviewsProcessed || 0,
        themesProcessed: existingRun.themesProcessed || 0,
        parameterVersionId: existingRun.parameterVersionId || 'unknown',
        ruleSetVersionId: existingRun.ruleSetVersionId || 'unknown',
        sentimentModelVersion: 'cached',
      };
    }
    
    // 4. Execute score run
    await updateProgress(job, 'Scoring reviews', 20);
    await job.log(`[${new Date().toISOString()}] Starting review scoring...`);
    
    const scoreRunResult = await executeScoreRun({
      tenantId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      triggeredById,
      parameterVersionId,
      ruleSetVersionId,
    });
    
    await job.log(`[${new Date().toISOString()}] Reviews scored: ${scoreRunResult.reviewsProcessed}`);
    await job.log(`[${new Date().toISOString()}] Themes aggregated: ${scoreRunResult.themesProcessed}`);
    await updateProgress(job, 'Reviews scored', 70, scoreRunResult.reviewsProcessed);
    
    // 5. Compute FixScores if requested
    let fixScoresComputed = 0;
    
    if (computeFixScores) {
      await updateProgress(job, 'Computing FixScores', 75);
      await job.log(`[${new Date().toISOString()}] Computing FixScores for completed tasks...`);
      
      const fixScoresSinceDate = fixScoresSince
        ? new Date(fixScoresSince)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days
      
      const fixScoreResults = await computeFixScoresForCompletedTasks(
        tenantId,
        scoreRunResult.scoreRunId,
        fixScoresSinceDate
      );
      
      fixScoresComputed = fixScoreResults.length;
      await job.log(`[${new Date().toISOString()}] FixScores computed: ${fixScoresComputed}`);
    }
    
    await updateProgress(job, 'Finalizing', 95);
    
    // 6. Update job log with summary
    await job.log(`[${new Date().toISOString()}] =====================================`);
    await job.log(`[${new Date().toISOString()}] SCORE RUN SUMMARY`);
    await job.log(`[${new Date().toISOString()}] =====================================`);
    await job.log(`[${new Date().toISOString()}] Score Run ID: ${scoreRunResult.scoreRunId}`);
    await job.log(`[${new Date().toISOString()}] Reviews Processed: ${scoreRunResult.reviewsProcessed}`);
    await job.log(`[${new Date().toISOString()}] Themes Processed: ${scoreRunResult.themesProcessed}`);
    await job.log(`[${new Date().toISOString()}] FixScores Computed: ${fixScoresComputed}`);
    await job.log(`[${new Date().toISOString()}] Parameter Version: ${scoreRunResult.parameterVersionId}`);
    await job.log(`[${new Date().toISOString()}] Rule Set Version: ${scoreRunResult.ruleSetVersionId}`);
    await job.log(`[${new Date().toISOString()}] Sentiment Model: ${scoreRunResult.sentimentModelVersion}`);
    await job.log(`[${new Date().toISOString()}] Duration: ${scoreRunResult.durationMs}ms`);
    await job.log(`[${new Date().toISOString()}] =====================================`);
    
    await updateProgress(job, 'Complete', 100);
    
    jobLogger.info({
      scoreRunId: scoreRunResult.scoreRunId,
      reviewsProcessed: scoreRunResult.reviewsProcessed,
      themesProcessed: scoreRunResult.themesProcessed,
      fixScoresComputed,
      durationMs: Date.now() - startTime,
    }, 'Score run job completed');
    
    return {
      ...createBaseJobResult(true, startTime),
      scoreRunId: scoreRunResult.scoreRunId,
      reviewsProcessed: scoreRunResult.reviewsProcessed,
      themesProcessed: scoreRunResult.themesProcessed,
      fixScoresComputed,
      parameterVersionId: scoreRunResult.parameterVersionId,
      ruleSetVersionId: scoreRunResult.ruleSetVersionId,
      sentimentModelVersion: scoreRunResult.sentimentModelVersion,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    jobLogger.error({ error }, 'Score run job failed');
    
    await job.log(`[${new Date().toISOString()}] =====================================`);
    await job.log(`[${new Date().toISOString()}] SCORE RUN FAILED`);
    await job.log(`[${new Date().toISOString()}] =====================================`);
    await job.log(`[${new Date().toISOString()}] Error: ${errorMessage}`);
    if (errorStack) {
      await job.log(`[${new Date().toISOString()}] Stack: ${errorStack.split('\n').slice(0, 5).join(' | ')}`);
    }
    await job.log(`[${new Date().toISOString()}] =====================================`);
    
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
