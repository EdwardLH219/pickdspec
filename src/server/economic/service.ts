/**
 * Economic Impact Service
 * 
 * Orchestrates economic impact calculations and persists results.
 */

import { db } from '@/server/db';
import type { EconomicParameters } from '@/server/parameters/types';
import { DEFAULT_PARAMETERS } from '@/server/parameters/defaults';
import { calculateRecommendationImpact, calculateAggregateImpact } from './calculations';
import type {
  BaselineMetricsInput,
  ChannelMetricsInput,
  RecommendationImpactInput,
  RecommendationEconomicImpactResult,
} from './types';
import { logger } from '@/lib/logger';

/**
 * Calculate and persist economic impacts for recommendations after they are generated
 */
export async function calculateAndPersistEconomicImpacts(
  tenantId: string,
  recommendationIds: string[],
  scoreRunId: string
): Promise<{ calculated: number; skipped: number }> {
  if (recommendationIds.length === 0) {
    return { calculated: 0, skipped: 0 };
  }

  console.log(`[ECONOMIC] Starting calculations for tenant ${tenantId}, ${recommendationIds.length} recommendations`);
  logger.info({ tenantId, recommendationCount: recommendationIds.length }, 'Starting economic impact calculations');

  // 1. Get active parameter version with economic settings, fall back to defaults
  const parameterVersion = await db.parameterSetVersion.findFirst({
    where: { status: 'ACTIVE' },
    select: { parameters: true },
  });

  const params = parameterVersion?.parameters as { economic?: EconomicParameters } | null;
  
  // Use economic params from active version, or fall back to defaults
  const economicParams: EconomicParameters = params?.economic ?? DEFAULT_PARAMETERS.economic as EconomicParameters;

  // Check if economic calculations are enabled (default is true)
  if (economicParams.enabled === false) {
    console.log(`[ECONOMIC] Calculations DISABLED for tenant ${tenantId}`);
    logger.info({ tenantId }, 'Economic calculations disabled in parameters');
    return { calculated: 0, skipped: recommendationIds.length };
  }

  console.log(`[ECONOMIC] Calculations ENABLED, using ${params?.economic ? 'stored' : 'default'} params`);
  logger.info({ tenantId, hasStoredParams: !!params?.economic }, 'Using economic parameters');

  // 2. Get baseline metrics for the tenant
  const baselineMetrics = await db.restaurantBaselineMetrics.findUnique({
    where: { tenantId },
  });

  const baselineInput: BaselineMetricsInput | null = baselineMetrics ? {
    coversPerMonth: baselineMetrics.coversPerMonth,
    seatCapacity: baselineMetrics.seatCapacity,
    averageTurnover: baselineMetrics.averageTurnover,
    averageSpendPerCover: baselineMetrics.averageSpendPerCover,
    averageOrderValue: baselineMetrics.averageOrderValue,
    currency: baselineMetrics.currency,
    daysOpenPerWeek: baselineMetrics.daysOpenPerWeek,
    servicesPerDay: baselineMetrics.servicesPerDay,
    confidenceLevel: baselineMetrics.confidenceLevel,
  } : null;

  console.log(`[ECONOMIC] Baseline metrics: hasData=${!!baselineMetrics}, covers=${baselineMetrics?.coversPerMonth}, spend=${baselineMetrics?.averageSpendPerCover}`);
  logger.info({ 
    tenantId, 
    hasBaseline: !!baselineMetrics,
    coversPerMonth: baselineMetrics?.coversPerMonth,
    averageSpend: baselineMetrics?.averageSpendPerCover,
  }, 'Baseline metrics status');

  // 3. Get channel metrics for the tenant (optional, latest)
  const channelMetrics = await db.channelMetrics.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  const channelInput: ChannelMetricsInput | null = channelMetrics ? {
    websiteClicks: channelMetrics.websiteClicks,
    directionsRequests: channelMetrics.directionsRequests,
    phoneCalls: channelMetrics.phoneCalls,
    searchViews: channelMetrics.searchViews,
    mapViews: channelMetrics.mapViews,
  } : null;

  // 4. Get recommendations with their theme data
  const recommendations = await db.recommendation.findMany({
    where: { id: { in: recommendationIds } },
    include: {
      theme: true,
    },
  });

  // 5. Get theme scores from this score run
  const themeScores = await db.themeScore.findMany({
    where: {
      scoreRunId,
      themeId: { in: recommendations.map(r => r.themeId).filter(Boolean) as string[] },
    },
  });

  const themeScoreMap = new Map(themeScores.map(ts => [ts.themeId, ts]));

  // 6. Calculate impacts for each recommendation
  const calculatedImpacts: RecommendationEconomicImpactResult[] = [];
  let skipped = 0;

  for (const rec of recommendations) {
    if (!rec.theme || !rec.themeId) {
      skipped++;
      continue;
    }

    const themeScore = themeScoreMap.get(rec.themeId);
    
    const recInput: RecommendationImpactInput = {
      recommendationId: rec.id,
      severity: rec.severity,
      themeId: rec.themeId,
      themeName: rec.theme.name,
      themeCategory: rec.theme.category,
      mentionCount: themeScore?.mentionCount ?? 0,
      negativeCount: themeScore?.negativeCount ?? 0,
      neutralCount: themeScore?.neutralCount ?? 0,
      sentimentScore: themeScore?.themeSentiment ?? 0,
      themeScore010: themeScore?.themeScore010 ?? 5,
    };

    try {
      const result = calculateRecommendationImpact(
        recInput,
        baselineInput,
        channelInput,
        economicParams
      );
      
      logger.info({
        recommendationId: rec.id,
        themeName: rec.theme.name,
        hasRevenueAtRisk: !!result.revenueAtRisk,
        hasRevenueUpside: !!result.revenueUpside,
        confidenceLevel: result.confidenceLevel,
        dataQualityScore: result.dataQualityScore,
        revenueAtRiskMid: result.revenueAtRisk?.mid,
        revenueUpsideMid: result.revenueUpside?.mid,
      }, 'Calculated economic impact for recommendation');
      
      calculatedImpacts.push(result);
    } catch (error) {
      logger.error({ error, recommendationId: rec.id }, 'Failed to calculate economic impact');
      skipped++;
    }
  }

  if (calculatedImpacts.length === 0) {
    console.log(`[ECONOMIC] No impacts calculated, all ${skipped} recommendations skipped`);
    return { calculated: 0, skipped };
  }

  console.log(`[ECONOMIC] Calculated ${calculatedImpacts.length} impacts, sample:`, 
    calculatedImpacts[0] ? {
      id: calculatedImpacts[0].recommendationId.slice(0, 8),
      revenueUpside: calculatedImpacts[0].revenueUpside,
      confidence: calculatedImpacts[0].confidenceLevel,
      dataQuality: calculatedImpacts[0].dataQualityScore,
    } : 'none');

  // 7. Calculate aggregate impact
  const aggregateImpact = calculateAggregateImpact(calculatedImpacts);

  // 8. Create EconomicImpactSnapshot
  const snapshot = await db.economicImpactSnapshot.create({
    data: {
      tenantId,
      scoreRunId,
      economicParameters: economicParams as object,
      baselineMetrics: baselineInput as object ?? undefined,
      estimatedRevenueImpact: aggregateImpact.totalRevenueUpside?.mid ?? null,
      estimatedFootfallImpact: aggregateImpact.totalFootfallUpside?.max ?? null,
      dataQualityScore: calculatedImpacts.reduce((sum, i) => sum + i.dataQualityScore, 0) / calculatedImpacts.length,
      confidenceLevel: aggregateImpact.averageConfidence,
      themeImpacts: calculatedImpacts.map(i => ({
        recommendationId: i.recommendationId,
        impactDriver: i.impactDriver,
        confidenceLevel: i.confidenceLevel,
      })),
    },
  });

  // 9. Persist individual recommendation impacts
  for (const result of calculatedImpacts) {
    try {
      await db.recommendationEconomicImpact.create({
        data: {
          tenantId,
          snapshotId: snapshot.id,
          recommendationId: result.recommendationId,
          revenueAtRiskMin: result.revenueAtRisk?.min ?? null,
          revenueAtRiskMax: result.revenueAtRisk?.max ?? null,
          revenueAtRiskMid: result.revenueAtRisk?.mid ?? null,
          revenueUpsideMin: result.revenueUpside?.min ?? null,
          revenueUpsideMax: result.revenueUpside?.max ?? null,
          revenueUpsideMid: result.revenueUpside?.mid ?? null,
          footfallAtRiskMin: result.footfallAtRisk?.min ?? null,
          footfallAtRiskMax: result.footfallAtRisk?.max ?? null,
          footfallUpsideMin: result.footfallUpside?.min ?? null,
          footfallUpsideMax: result.footfallUpside?.max ?? null,
          impactDriver: result.impactDriver as 'ACQUISITION' | 'CONVERSION' | 'RETENTION',
          impactDriverScore: result.impactDriverScore,
          confidenceLevel: result.confidenceLevel as 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA',
          dataQualityScore: result.dataQualityScore,
          currency: result.currency,
          explainPayload: result.explainPayload as object,
          inputSeverity: result.inputSeverity,
          inputMentionCount: result.inputMentionCount,
          inputSentimentScore: result.inputSentimentScore,
          inputThemeScore010: result.inputThemeScore010,
        },
      });

      logger.debug({
        recommendationId: result.recommendationId,
        confidenceLevel: result.confidenceLevel,
        revenueUpside: result.revenueUpside,
      }, 'Economic impact persisted');

    } catch (error) {
      logger.error({ error, recommendationId: result.recommendationId }, 'Failed to persist economic impact');
      skipped++;
    }
  }

  console.log(`[ECONOMIC] PERSISTED snapshot ${snapshot.id.slice(0, 8)}... with ${calculatedImpacts.length} impacts`);
  logger.info({
    tenantId,
    snapshotId: snapshot.id,
    calculated: calculatedImpacts.length,
    skipped,
  }, 'Economic impact calculations complete');

  return { calculated: calculatedImpacts.length, skipped };
}

/**
 * Recalculate economic impacts for existing recommendations
 * Useful when baseline metrics are updated or parameters change
 */
export async function recalculateEconomicImpactsForTenant(
  tenantId: string
): Promise<{ calculated: number; skipped: number }> {
  console.log(`[ECONOMIC] Recalculating impacts for tenant ${tenantId}`);
  
  // Get the latest score run
  const latestRun = await db.scoreRun.findFirst({
    where: { tenantId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });

  if (!latestRun) {
    console.log(`[ECONOMIC] No completed score run found for tenant ${tenantId}`);
    return { calculated: 0, skipped: 0 };
  }
  
  console.log(`[ECONOMIC] Found score run ${latestRun.id.slice(0, 8)}...`);

  // Get open recommendations
  const recommendations = await db.recommendation.findMany({
    where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    select: { id: true },
  });

  if (recommendations.length === 0) {
    return { calculated: 0, skipped: 0 };
  }

  // Delete existing snapshot and impacts for this score run (cascade will delete impacts)
  await db.economicImpactSnapshot.deleteMany({
    where: { scoreRunId: latestRun.id },
  });

  // Recalculate
  return calculateAndPersistEconomicImpacts(
    tenantId,
    recommendations.map(r => r.id),
    latestRun.id
  );
}
