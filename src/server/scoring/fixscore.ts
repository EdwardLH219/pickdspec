/**
 * FixScore Computation
 * 
 * Measures the effectiveness of actions taken to address themes.
 * 
 * Formulas:
 * - C.12: ΔS = S_after - S_before (range [-2, +2])
 * - C.13: FixScore = ΔS × log(1 + review_count) × Confidence
 */

import { db } from '@/server/db';
import { ConfidenceLevel, TaskStatus, Sentiment } from '@prisma/client';
import type { ParameterSet } from '@/server/parameters/types';
import { getActiveParameterVersion } from '@/server/parameters/service';
import { getActiveRuleExecutor } from '@/server/rules/service';
import type { FixScoreContext, SufficiencyResult } from '@/server/rules/types';
import { SufficiencyLevel, SufficiencyReasonCode } from '@/server/rules/types';
import { calculateThemeSentiment } from './calculations';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

/**
 * FixScore computation input
 */
export interface FixScoreInput {
  /** Task that was completed */
  taskId: string;
  
  /** Theme being measured */
  themeId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Score run ID for linkage */
  scoreRunId: string;
  
  /** Optional: Override task completion date */
  completionDate?: Date;
}

/**
 * FixScore computation result
 */
export interface FixScoreResult {
  /** Theme ID */
  themeId: string;
  
  /** Task ID (if linked) */
  taskId: string | null;
  
  /** Baseline (pre) sentiment score */
  baselineScore: number;
  
  /** Current (post) sentiment score */
  currentScore: number;
  
  /** Change in sentiment [-2, +2] */
  deltaS: number;
  
  /** Number of reviews in pre-period */
  reviewCountPre: number;
  
  /** Number of reviews in post-period */
  reviewCountPost: number;
  
  /** Confidence score [0, 1] */
  confidence: number;
  
  /** Confidence level category */
  confidenceLevel: ConfidenceLevel;
  
  /** Final FixScore value */
  fixScore: number;
  
  /** Measurement period start (pre-window start) */
  measurementStart: Date;
  
  /** Measurement period end (post-window end) */
  measurementEnd: Date;
  
  /** Full explain payload */
  components: FixScoreComponents;
}

/**
 * FixScore explain payload
 */
export interface FixScoreComponents {
  /** Pre-period analysis */
  prePeriod: {
    start: Date;
    end: Date;
    reviewCount: number;
    themeSentiment: number;
    sumWeightedImpact: number;
    sumAbsWeightedImpact: number;
  };
  
  /** Post-period analysis */
  postPeriod: {
    start: Date;
    end: Date;
    reviewCount: number;
    themeSentiment: number;
    sumWeightedImpact: number;
    sumAbsWeightedImpact: number;
  };
  
  /** Delta calculation */
  delta: {
    deltaS: number;
    deltaReviewCount: number;
    percentChange: number | null;
  };
  
  /** Confidence determination */
  confidenceAnalysis: {
    level: SufficiencyLevel;
    reasonCode: SufficiencyReasonCode;
    score: number;
    matchedRuleId: string | null;
    totalReviewCount: number;
  };
  
  /** Formula breakdown */
  formula: {
    deltaS: number;
    logReviewFactor: number;
    confidence: number;
    fixScore: number;
  };
  
  /** Version references */
  versions: {
    parameterVersionId: string;
    ruleSetVersionId: string;
  };
}

/**
 * Period analysis result
 */
interface PeriodAnalysis {
  start: Date;
  end: Date;
  reviewCount: number;
  themeSentiment: number;
  sumWeightedImpact: number;
  sumAbsWeightedImpact: number;
  weightedImpacts: number[];
}

// ============================================================
// CALCULATIONS
// ============================================================

/**
 * C.12: Calculate Delta S (change in sentiment)
 * 
 * Formula: ΔS = S_after - S_before
 * Range: [-2, +2]
 */
export function calculateDeltaS(baselineScore: number, currentScore: number): number {
  const deltaS = currentScore - baselineScore;
  // Clamp to [-2, +2] for safety
  return Math.max(-2, Math.min(2, deltaS));
}

/**
 * C.13: Calculate FixScore
 * 
 * Formula: FixScore = ΔS × log(1 + review_count) × Confidence
 */
export function calculateFixScoreValue(
  deltaS: number,
  reviewCount: number,
  confidence: number
): number {
  const logReviewFactor = Math.log(1 + reviewCount);
  return deltaS * logReviewFactor * confidence;
}

/**
 * Map SufficiencyLevel to ConfidenceLevel
 */
function mapSufficiencyToConfidence(level: SufficiencyLevel): ConfidenceLevel {
  switch (level) {
    case SufficiencyLevel.INSUFFICIENT:
      return ConfidenceLevel.INSUFFICIENT;
    case SufficiencyLevel.LOW:
      return ConfidenceLevel.LOW;
    case SufficiencyLevel.MEDIUM:
      return ConfidenceLevel.MEDIUM;
    case SufficiencyLevel.HIGH:
      return ConfidenceLevel.HIGH;
    default:
      return ConfidenceLevel.INSUFFICIENT;
  }
}

/**
 * Analyze a measurement period for a theme
 */
async function analyzePeriod(
  tenantId: string,
  themeId: string,
  periodStart: Date,
  periodEnd: Date,
  scoreRunId?: string
): Promise<PeriodAnalysis> {
  // Get review scores for this theme in the period
  // If scoreRunId is provided, use scores from that run
  // Otherwise, get the latest scores for reviews in the period
  
  const whereClause: Record<string, unknown> = {
    tenantId,
    reviewDate: {
      gte: periodStart,
      lte: periodEnd,
    },
    reviewThemes: {
      some: {
        themeId,
      },
    },
  };
  
  // Get reviews with their scores
  const reviews = await db.review.findMany({
    where: whereClause,
    include: {
      reviewThemes: {
        where: { themeId },
      },
      reviewScores: scoreRunId ? {
        where: { scoreRunId },
      } : {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  
  // Extract weighted impacts
  const weightedImpacts: number[] = [];
  
  for (const review of reviews) {
    const score = review.reviewScores[0];
    if (score) {
      weightedImpacts.push(score.weightedImpact);
    }
  }
  
  // Calculate theme sentiment for the period
  const { sentiment, sumWr, sumAbsWr } = calculateThemeSentiment(weightedImpacts);
  
  return {
    start: periodStart,
    end: periodEnd,
    reviewCount: weightedImpacts.length,
    themeSentiment: sentiment,
    sumWeightedImpact: sumWr,
    sumAbsWeightedImpact: sumAbsWr,
    weightedImpacts,
  };
}

// ============================================================
// MAIN COMPUTATION
// ============================================================

/**
 * Compute FixScore for a completed task
 */
export async function computeFixScore(
  input: FixScoreInput,
  params?: ParameterSet
): Promise<FixScoreResult> {
  const { taskId, themeId, tenantId, scoreRunId, completionDate } = input;
  
  // Get parameters
  let parameters = params;
  if (!parameters) {
    const paramVersion = await getActiveParameterVersion();
    if (!paramVersion) {
      throw new Error('No active parameter version found');
    }
    parameters = paramVersion.parameters as unknown as ParameterSet;
  }
  
  // Use extended windows for better data capture (override shorter stored values)
  const pre_window_days = Math.max(parameters.fix_tracking.pre_window_days, 90);
  const post_window_days = Math.max(parameters.fix_tracking.post_window_days, 60);
  const { min_reviews_for_inference, confidence_thresholds } = parameters.fix_tracking;
  
  // Determine completion date
  let actionDate = completionDate;
  if (!actionDate && taskId) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { completedAt: true },
    });
    actionDate = task?.completedAt ?? new Date();
  }
  actionDate = actionDate ?? new Date();
  
  // Calculate measurement windows
  let preStart = new Date(actionDate);
  preStart.setDate(preStart.getDate() - pre_window_days);
  
  const preEnd = new Date(actionDate);
  preEnd.setDate(preEnd.getDate() - 1); // Day before action
  
  const postStart = new Date(actionDate);
  
  let postEnd = new Date(actionDate);
  postEnd.setDate(postEnd.getDate() + post_window_days);
  
  // Analyze both periods
  let prePeriod = await analyzePeriod(tenantId, themeId, preStart, preEnd, scoreRunId);
  
  // If no baseline data found, progressively extend the pre-window up to 365 days
  if (prePeriod.reviewCount === 0 && pre_window_days < 365) {
    const extendedPreStart = new Date(actionDate);
    extendedPreStart.setDate(extendedPreStart.getDate() - 365);
    logger.info({ themeId, originalPreStart: preStart, extendedPreStart }, 'Extending pre-window to find baseline data');
    prePeriod = await analyzePeriod(tenantId, themeId, extendedPreStart, preEnd, scoreRunId);
    preStart = extendedPreStart;
  }
  
  let postPeriod = await analyzePeriod(tenantId, themeId, postStart, postEnd, scoreRunId);
  
  // If no post data found, extend to current date
  if (postPeriod.reviewCount === 0) {
    const extendedPostEnd = new Date();
    logger.info({ themeId, originalPostEnd: postEnd, extendedPostEnd }, 'Extending post-window to find post-action data');
    postPeriod = await analyzePeriod(tenantId, themeId, postStart, extendedPostEnd, scoreRunId);
    postEnd = extendedPostEnd;
  }
  
  // Calculate delta
  const deltaS = calculateDeltaS(prePeriod.themeSentiment, postPeriod.themeSentiment);
  const totalReviewCount = prePeriod.reviewCount + postPeriod.reviewCount;
  
  // Get rule executor for sufficiency determination
  const { executor: ruleExecutor, versionId: ruleSetVersionId } = await getActiveRuleExecutor();
  
  // Build context for sufficiency rules
  const fixScoreContext: FixScoreContext = {
    themeId,
    taskId,
    reviewCountPre: prePeriod.reviewCount,
    reviewCountPost: postPeriod.reviewCount,
    totalReviews: totalReviewCount,
    scoreBefore: prePeriod.themeSentiment,
    scoreAfter: postPeriod.themeSentiment,
    deltaS,
    variancePre: null, // TODO: Calculate variance if needed
    variancePost: null,
    preWindowDays: pre_window_days,
    postWindowDays: post_window_days,
  };
  
  // Evaluate sufficiency rules
  const sufficiencyResult = ruleExecutor.evaluateSufficiency(fixScoreContext);
  
  // Map to confidence level and score
  const confidenceLevel = mapSufficiencyToConfidence(sufficiencyResult.level);
  const confidence = sufficiencyResult.score;
  
  // Calculate FixScore
  const logReviewFactor = Math.log(1 + totalReviewCount);
  const fixScoreValue = calculateFixScoreValue(deltaS, totalReviewCount, confidence);
  
  // Get parameter version ID
  const activeParamVersion = await getActiveParameterVersion();
  const parameterVersionId = activeParamVersion?.versionId ?? 'unknown';
  
  // Build components (explain payload)
  const components: FixScoreComponents = {
    prePeriod: {
      start: prePeriod.start,
      end: prePeriod.end,
      reviewCount: prePeriod.reviewCount,
      themeSentiment: prePeriod.themeSentiment,
      sumWeightedImpact: prePeriod.sumWeightedImpact,
      sumAbsWeightedImpact: prePeriod.sumAbsWeightedImpact,
    },
    postPeriod: {
      start: postPeriod.start,
      end: postPeriod.end,
      reviewCount: postPeriod.reviewCount,
      themeSentiment: postPeriod.themeSentiment,
      sumWeightedImpact: postPeriod.sumWeightedImpact,
      sumAbsWeightedImpact: postPeriod.sumAbsWeightedImpact,
    },
    delta: {
      deltaS,
      deltaReviewCount: postPeriod.reviewCount - prePeriod.reviewCount,
      percentChange: prePeriod.reviewCount > 0 
        ? ((postPeriod.reviewCount - prePeriod.reviewCount) / prePeriod.reviewCount) * 100
        : null,
    },
    confidenceAnalysis: {
      level: sufficiencyResult.level,
      reasonCode: sufficiencyResult.explain.reasonCode,
      score: confidence,
      matchedRuleId: sufficiencyResult.explain.appliedRule?.ruleId ?? null,
      totalReviewCount,
    },
    formula: {
      deltaS,
      logReviewFactor,
      confidence,
      fixScore: fixScoreValue,
    },
    versions: {
      parameterVersionId,
      ruleSetVersionId,
    },
  };
  
  return {
    themeId,
    taskId,
    baselineScore: prePeriod.themeSentiment,
    currentScore: postPeriod.themeSentiment,
    deltaS,
    reviewCountPre: prePeriod.reviewCount,
    reviewCountPost: postPeriod.reviewCount,
    confidence,
    confidenceLevel,
    fixScore: fixScoreValue,
    measurementStart: preStart,
    measurementEnd: postEnd,
    components,
  };
}

/**
 * Compute and persist FixScore for a task
 */
export async function computeAndPersistFixScore(
  input: FixScoreInput
): Promise<{ id: string; result: FixScoreResult }> {
  const result = await computeFixScore(input);
  
  // Persist to database
  const fixScore = await db.fixScore.create({
    data: {
      tenantId: input.tenantId,
      themeId: result.themeId,
      taskId: result.taskId,
      scoreRunId: input.scoreRunId,
      baselineScore: result.baselineScore,
      currentScore: result.currentScore,
      deltaS: result.deltaS,
      reviewCountPre: result.reviewCountPre,
      reviewCountPost: result.reviewCountPost,
      confidence: result.confidence,
      confidenceLevel: result.confidenceLevel,
      fixScore: result.fixScore,
      measurementStart: result.measurementStart,
      measurementEnd: result.measurementEnd,
    },
  });
  
  logger.info({
    fixScoreId: fixScore.id,
    themeId: result.themeId,
    taskId: result.taskId,
    deltaS: result.deltaS,
    confidence: result.confidence,
    fixScore: result.fixScore,
  }, 'FixScore computed and persisted');
  
  return { id: fixScore.id, result };
}

/**
 * Compute FixScores for all recently completed tasks
 */
export async function computeFixScoresForCompletedTasks(
  tenantId: string,
  scoreRunId: string,
  since?: Date
): Promise<Array<{ taskId: string; fixScoreId: string; result: FixScoreResult }>> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days
  
  // Find tasks completed since the given date with associated themes
  const completedTasks = await db.task.findMany({
    where: {
      tenantId,
      status: TaskStatus.COMPLETED,
      completedAt: {
        gte: sinceDate,
      },
      themeId: {
        not: null,
      },
    },
    include: {
      theme: true,
    },
  });
  
  const results: Array<{ taskId: string; fixScoreId: string; result: FixScoreResult }> = [];
  
  for (const task of completedTasks) {
    if (!task.themeId) continue;
    
    try {
      const { id: fixScoreId, result } = await computeAndPersistFixScore({
        taskId: task.id,
        themeId: task.themeId,
        tenantId,
        scoreRunId,
        completionDate: task.completedAt ?? undefined,
      });
      
      results.push({ taskId: task.id, fixScoreId, result });
    } catch (error) {
      logger.error({
        error,
        taskId: task.id,
        themeId: task.themeId,
      }, 'Failed to compute FixScore for task');
    }
  }
  
  return results;
}

/**
 * Compute FixScores for themes without task linkage
 * (measures theme improvement over time)
 */
export async function computeFixScoresForThemes(
  tenantId: string,
  scoreRunId: string,
  themeIds: string[],
  measurementDate?: Date
): Promise<Array<{ themeId: string; fixScoreId: string; result: FixScoreResult }>> {
  const results: Array<{ themeId: string; fixScoreId: string; result: FixScoreResult }> = [];
  
  for (const themeId of themeIds) {
    try {
      const { id: fixScoreId, result } = await computeAndPersistFixScore({
        taskId: '', // No task linkage
        themeId,
        tenantId,
        scoreRunId,
        completionDate: measurementDate,
      });
      
      results.push({ themeId, fixScoreId, result });
    } catch (error) {
      logger.error({
        error,
        themeId,
      }, 'Failed to compute FixScore for theme');
    }
  }
  
  return results;
}

// ============================================================
// QUERY HELPERS
// ============================================================

/**
 * Get FixScore by ID with full explain payload
 */
export async function getFixScoreWithDetails(fixScoreId: string) {
  return db.fixScore.findUnique({
    where: { id: fixScoreId },
    include: {
      theme: true,
      task: true,
      scoreRun: {
        include: {
          parameterVersion: true,
          ruleSetVersion: true,
        },
      },
    },
  });
}

/**
 * Get FixScores for a task
 */
export async function getFixScoresForTask(taskId: string) {
  return db.fixScore.findMany({
    where: { taskId },
    include: {
      theme: true,
      scoreRun: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get FixScores for a theme
 */
export async function getFixScoresForTheme(themeId: string) {
  return db.fixScore.findMany({
    where: { themeId },
    include: {
      task: true,
      scoreRun: true,
    },
    orderBy: { measurementEnd: 'desc' },
  });
}

/**
 * Get FixScores for a score run
 */
export async function getFixScoresForRun(scoreRunId: string) {
  return db.fixScore.findMany({
    where: { scoreRunId },
    include: {
      theme: true,
      task: true,
    },
    orderBy: { fixScore: 'desc' },
  });
}

/**
 * Get high-impact FixScores (most improved themes)
 */
export async function getHighImpactFixScores(
  tenantId: string,
  limit: number = 10,
  minConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
) {
  const confidenceLevels: ConfidenceLevel[] = [ConfidenceLevel.HIGH];
  if (minConfidence === 'MEDIUM' || minConfidence === 'LOW') {
    confidenceLevels.push(ConfidenceLevel.MEDIUM);
  }
  if (minConfidence === 'LOW') {
    confidenceLevels.push(ConfidenceLevel.LOW);
  }
  
  return db.fixScore.findMany({
    where: {
      tenantId,
      confidenceLevel: {
        in: confidenceLevels,
      },
    },
    include: {
      theme: true,
      task: true,
    },
    orderBy: { fixScore: 'desc' },
    take: limit,
  });
}
