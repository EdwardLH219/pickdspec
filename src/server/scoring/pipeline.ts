/**
 * Scoring Pipeline
 * 
 * Orchestrates the scoring process:
 * 1. Score individual reviews (S_r, W_time, W_source, W_engagement, W_confidence, W_r)
 * 2. Aggregate theme scores (S_theme, theme_score_0_10, mentions, Severity)
 * 3. Persist results with full explain payloads and version references
 */

import { db } from '@/server/db';
import { Sentiment, TrendDirection } from '@prisma/client';
import type { ParameterSet } from '@/server/parameters/types';
import { createSnapshotForRun, getActiveParameterVersion } from '@/server/parameters/service';
import { getActiveRuleExecutor, pinRuleSetToScoreRun } from '@/server/rules/service';
import type { ReviewContext, ConfidenceResult } from '@/server/rules/types';
import {
  analyzeSentiment,
  getSentimentModelVersion,
} from './sentiment';
import {
  calculateTimeWeight,
  calculateSourceWeight,
  calculateEngagementWeight,
  calculateWeightedImpact,
  aggregateThemeScores,
  type ReviewData,
  type ReviewScoreComponents,
  type ReviewScoreResult,
  type ThemeAggregationResult,
} from './calculations';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

/**
 * Score run configuration
 */
export interface ScoreRunConfig {
  /** Tenant ID to score */
  tenantId: string;
  
  /** Start of scoring period */
  periodStart: Date;
  
  /** End of scoring period */
  periodEnd: Date;
  
  /** Reference date for time decay (defaults to periodEnd) */
  asOfDate?: Date;
  
  /** User who triggered the run */
  triggeredById?: string;
  
  /** Parameter version ID (uses active if not specified) */
  parameterVersionId?: string;
  
  /** Rule set version ID (uses active if not specified) */
  ruleSetVersionId?: string;
}

/**
 * Score run result
 */
export interface ScoreRunResult {
  scoreRunId: string;
  tenantId: string;
  reviewsProcessed: number;
  themesProcessed: number;
  parameterVersionId: string;
  ruleSetVersionId: string;
  sentimentModelVersion: string;
  durationMs: number;
}

/**
 * Review with themes data
 */
interface ReviewWithThemes extends ReviewData {
  reviewThemes: Array<{
    themeId: string;
    sentiment: Sentiment;
    confidenceScore: number;
  }>;
}

// ============================================================
// REVIEW SCORING
// ============================================================

/**
 * Score a single review
 */
export async function scoreReview(
  review: ReviewData,
  params: ParameterSet,
  asOfDate: Date,
  ruleExecutor: { evaluateConfidence: (ctx: ReviewContext) => ConfidenceResult }
): Promise<ReviewScoreResult> {
  // 1. Calculate base sentiment (S_r)
  const sentimentResponse = await analyzeSentiment({
    content: review.content,
    language: review.detectedLanguage ?? undefined,
    context: {
      businessType: 'restaurant',
      starRating: review.rating ?? undefined,
    },
  });
  
  // Blend with star rating if enabled
  let baseSentimentScore = sentimentResponse.score;
  let ratingBlended = false;
  
  if (params.sentiment.use_star_rating && review.rating !== null) {
    const ratingNormalized = (review.rating - 3) / 2; // Convert 1-5 to [-1, +1]
    const blendWeight = params.sentiment.star_rating_blend_weight ?? 0.3;
    baseSentimentScore = sentimentResponse.score * (1 - blendWeight) + ratingNormalized * blendWeight;
    ratingBlended = true;
  }
  
  // 2. Calculate time weight (W_time)
  const timeWeight = calculateTimeWeight(
    review.reviewDate,
    asOfDate,
    params.time.review_half_life_days
  );
  
  // 3. Calculate source weight (W_source)
  const sourceWeight = calculateSourceWeight(review.sourceType, params);
  
  // 4. Calculate engagement weight (W_engagement)
  const engagementWeight = calculateEngagementWeight(
    review.likesCount,
    review.repliesCount,
    review.helpfulCount,
    review.sourceType,
    params
  );
  
  // 5. Calculate confidence weight (W_confidence) using rules
  const reviewContext: ReviewContext = {
    id: review.id,
    content: review.content,
    contentLength: review.content.length,
    rating: review.rating,
    sourceType: review.sourceType,
    authorName: review.authorName,
    detectedLanguage: review.detectedLanguage,
    duplicateSimilarity: review.duplicateSimilarity,
    likesCount: review.likesCount,
    repliesCount: review.repliesCount,
    sentimentScore: baseSentimentScore,
  };
  
  const confidenceResult = ruleExecutor.evaluateConfidence(reviewContext);
  
  // 6. Calculate weighted impact (W_r)
  const weightedImpact = calculateWeightedImpact(
    baseSentimentScore,
    timeWeight.value,
    sourceWeight.value,
    engagementWeight.value,
    confidenceResult.score
  );
  
  // Build components for explain payload
  const components: ReviewScoreComponents = {
    baseSentiment: {
      score: baseSentimentScore,
      modelVersion: sentimentResponse.modelVersion,
      rawScore: sentimentResponse.score,
      ratingBlended,
      confidence: sentimentResponse.confidence,
    },
    timeWeight: {
      value: timeWeight.value,
      daysDelta: timeWeight.daysDelta,
      halfLifeDays: timeWeight.halfLifeDays,
    },
    sourceWeight: {
      value: sourceWeight.value,
      sourceType: sourceWeight.sourceType,
      rawWeight: sourceWeight.rawWeight,
      clamped: sourceWeight.clamped,
    },
    engagementWeight: {
      value: engagementWeight.value,
      enabled: engagementWeight.enabled,
      rawValue: engagementWeight.rawValue,
      capped: engagementWeight.capped,
      engagement: engagementWeight.engagement,
    },
    confidenceWeight: {
      value: confidenceResult.score,
      ruleId: confidenceResult.explain.appliedRule?.ruleId ?? null,
      reasonCode: confidenceResult.explain.reasonCode,
      matchedConditions: confidenceResult.explain.appliedRule?.matchedConditions ?? [],
    },
    weightedImpact,
  };
  
  return {
    reviewId: review.id,
    baseSentiment: baseSentimentScore,
    timeWeight: timeWeight.value,
    sourceWeight: sourceWeight.value,
    engagementWeight: engagementWeight.value,
    confidenceWeight: confidenceResult.score,
    weightedImpact,
    components,
  };
}

// ============================================================
// SCORING PIPELINE
// ============================================================

/**
 * Execute a full scoring run
 */
export async function executeScoreRun(config: ScoreRunConfig): Promise<ScoreRunResult> {
  const startTime = Date.now();
  const asOfDate = config.asOfDate ?? config.periodEnd;
  
  logger.info({
    tenantId: config.tenantId,
    periodStart: config.periodStart,
    periodEnd: config.periodEnd,
  }, 'Starting score run');
  
  // 1. Get parameter version
  const parameterVersion = config.parameterVersionId 
    ? await db.parameterSetVersion.findUnique({ where: { id: config.parameterVersionId } })
    : (await getActiveParameterVersion());
  
  if (!parameterVersion) {
    throw new Error('No parameter version available');
  }
  
  const params = (parameterVersion.parameters ?? parameterVersion) as unknown as ParameterSet;
  const parameterVersionId = 'versionId' in parameterVersion 
    ? parameterVersion.versionId as string
    : parameterVersion.id;
  
  // 2. Get rule executor
  const { executor: ruleExecutor, versionId: ruleSetVersionId } = await getActiveRuleExecutor();
  
  // 3. Create score run record
  const scoreRun = await db.scoreRun.create({
    data: {
      tenantId: config.tenantId,
      parameterVersionId,
      ruleSetVersionId: ruleSetVersionId === 'default' ? null : ruleSetVersionId,
      runType: config.triggeredById ? 'MANUAL' : 'SCHEDULED',
      status: 'RUNNING',
      periodStart: config.periodStart,
      periodEnd: config.periodEnd,
      startedAt: new Date(),
      triggeredById: config.triggeredById,
    },
  });
  
  const sentimentModelVersion = getSentimentModelVersion();
  
  try {
    // 4. Fetch reviews for the period with theme associations
    const reviews = await db.review.findMany({
      where: {
        tenantId: config.tenantId,
        reviewDate: {
          gte: config.periodStart,
          lte: config.periodEnd,
        },
      },
      include: {
        connector: true,
        reviewThemes: {
          include: {
            theme: true,
          },
        },
      },
    });
    
    logger.info({ reviewCount: reviews.length }, 'Fetched reviews for scoring');
    
    // 5. Score each review
    const reviewScores: ReviewScoreResult[] = [];
    const reviewThemeMap = new Map<string, Array<{ reviewScoreResult: ReviewScoreResult; sentiment: Sentiment }>>();
    
    for (const review of reviews) {
      const reviewData: ReviewData = {
        id: review.id,
        content: review.content,
        rating: review.rating,
        reviewDate: review.reviewDate,
        sourceType: review.connector?.sourceType ?? 'TILL_SLIP',
        likesCount: review.likesCount,
        repliesCount: review.repliesCount,
        helpfulCount: review.helpfulCount,
        duplicateSimilarity: review.duplicateSimilarity,
        detectedLanguage: review.detectedLanguage,
        authorName: review.authorName,
      };
      
      const scoreResult = await scoreReview(reviewData, params, asOfDate, ruleExecutor);
      reviewScores.push(scoreResult);
      
      // Map review scores to themes
      for (const rt of review.reviewThemes) {
        if (!reviewThemeMap.has(rt.themeId)) {
          reviewThemeMap.set(rt.themeId, []);
        }
        reviewThemeMap.get(rt.themeId)!.push({
          reviewScoreResult: scoreResult,
          sentiment: rt.sentiment,
        });
      }
    }
    
    // 6. Persist review scores
    const reviewScoreRecords = reviewScores.map(rs => ({
      reviewId: rs.reviewId,
      scoreRunId: scoreRun.id,
      baseSentiment: rs.baseSentiment,
      timeWeight: rs.timeWeight,
      sourceWeight: rs.sourceWeight,
      engagementWeight: rs.engagementWeight,
      confidenceWeight: rs.confidenceWeight,
      weightedImpact: rs.weightedImpact,
      components: JSON.parse(JSON.stringify({
        ...rs.components,
        sentimentModelVersion,
        parameterVersionId,
        ruleSetVersionId,
      })),
    }));
    
    if (reviewScoreRecords.length > 0) {
      await db.reviewScore.createMany({
        data: reviewScoreRecords,
      });
    }
    
    logger.info({ count: reviewScoreRecords.length }, 'Persisted review scores');
    
    // 7. Aggregate and persist theme scores
    const themeIds = Array.from(reviewThemeMap.keys());
    const themeScores: ThemeAggregationResult[] = [];
    
    for (const themeId of themeIds) {
      const themeReviews = reviewThemeMap.get(themeId)!;
      
      const aggregationInput = {
        themeId,
        reviewScores: themeReviews.map(tr => ({
          weightedImpact: tr.reviewScoreResult.weightedImpact,
          sentiment: tr.sentiment === Sentiment.POSITIVE 
            ? 'positive' as const
            : tr.sentiment === Sentiment.NEGATIVE
              ? 'negative' as const
              : 'neutral' as const,
        })),
      };
      
      const themeScore = aggregateThemeScores(aggregationInput);
      themeScores.push(themeScore);
    }
    
    // Persist theme scores
    const themeScoreRecords = themeScores.map(ts => ({
      tenantId: config.tenantId,
      themeId: ts.themeId,
      scoreRunId: scoreRun.id,
      periodStart: config.periodStart,
      periodEnd: config.periodEnd,
      mentionCount: ts.mentionCount,
      positiveCount: ts.positiveCount,
      neutralCount: ts.neutralCount,
      negativeCount: ts.negativeCount,
      sumWeightedImpact: ts.sumWeightedImpact,
      sumAbsWeightedImpact: ts.sumAbsWeightedImpact,
      themeSentiment: ts.themeSentiment,
      themeScore010: ts.themeScore010,
      severity: ts.severity,
    }));
    
    if (themeScoreRecords.length > 0) {
      await db.themeScore.createMany({
        data: themeScoreRecords,
      });
    }
    
    logger.info({ count: themeScoreRecords.length }, 'Persisted theme scores');
    
    // 8. Update score run status
    const durationMs = Date.now() - startTime;
    
    await db.scoreRun.update({
      where: { id: scoreRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs,
        reviewsProcessed: reviewScores.length,
        themesProcessed: themeScores.length,
      },
    });
    
    logger.info({
      scoreRunId: scoreRun.id,
      reviewsProcessed: reviewScores.length,
      themesProcessed: themeScores.length,
      durationMs,
    }, 'Score run completed');
    
    return {
      scoreRunId: scoreRun.id,
      tenantId: config.tenantId,
      reviewsProcessed: reviewScores.length,
      themesProcessed: themeScores.length,
      parameterVersionId,
      ruleSetVersionId,
      sentimentModelVersion,
      durationMs,
    };
    
  } catch (error) {
    // Update score run with error
    await db.scoreRun.update({
      where: { id: scoreRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    logger.error({ error, scoreRunId: scoreRun.id }, 'Score run failed');
    throw error;
  }
}

// ============================================================
// QUERY HELPERS
// ============================================================

/**
 * Get review scores for a score run
 */
export async function getReviewScoresForRun(scoreRunId: string) {
  return db.reviewScore.findMany({
    where: { scoreRunId },
    include: {
      review: {
        include: {
          connector: true,
        },
      },
    },
    orderBy: { weightedImpact: 'desc' },
  });
}

/**
 * Get theme scores for a score run
 */
export async function getThemeScoresForRun(scoreRunId: string) {
  return db.themeScore.findMany({
    where: { scoreRunId },
    include: {
      theme: true,
    },
    orderBy: { severity: 'desc' },
  });
}

/**
 * Get the latest score run for a tenant
 */
export async function getLatestScoreRun(tenantId: string) {
  return db.scoreRun.findFirst({
    where: { 
      tenantId,
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    include: {
      parameterVersion: true,
      ruleSetVersion: true,
    },
  });
}

/**
 * Get score run details
 */
export async function getScoreRunDetails(scoreRunId: string) {
  const scoreRun = await db.scoreRun.findUnique({
    where: { id: scoreRunId },
    include: {
      tenant: true,
      parameterVersion: true,
      ruleSetVersion: true,
      triggeredBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });
  
  if (!scoreRun) return null;
  
  const reviewScores = await db.reviewScore.count({ where: { scoreRunId } });
  const themeScores = await db.themeScore.count({ where: { scoreRunId } });
  
  return {
    ...scoreRun,
    reviewScoreCount: reviewScores,
    themeScoreCount: themeScores,
  };
}
