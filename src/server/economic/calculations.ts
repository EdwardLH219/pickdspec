/**
 * Economic Impact Calculations
 * 
 * Calculates revenue at risk and upside potential for recommendations.
 * Based on research linking rating changes to revenue impact (Harvard/Yelp studies).
 */

import type { RecommendationSeverity, ThemeCategory } from '@prisma/client';
import type { EconomicParameters } from '@/server/parameters/types';
import type {
  BaselineMetricsInput,
  ChannelMetricsInput,
  RecommendationImpactInput,
  RecommendationEconomicImpactResult,
  ValueRange,
  ImpactDriverType,
  ConfidenceLevelType,
  ExplainPayload,
  CalculationStep,
  DataQualityFactor,
} from './types';
import {
  SEVERITY_MULTIPLIERS,
  SEVERITY_RATING_IMPACT,
  THEME_IMPACT_DRIVERS,
} from './types';

// ============================================================
// MAIN CALCULATION FUNCTION
// ============================================================

/**
 * Calculate economic impact for a single recommendation
 */
export function calculateRecommendationImpact(
  recommendation: RecommendationImpactInput,
  baselineMetrics: BaselineMetricsInput | null,
  channelMetrics: ChannelMetricsInput | null,
  economicParams: EconomicParameters
): RecommendationEconomicImpactResult {
  const steps: CalculationStep[] = [];
  const caveats: string[] = [];
  
  // Step 1: Check if we have enough data
  const dataQuality = assessDataQuality(
    recommendation,
    baselineMetrics,
    channelMetrics,
    economicParams
  );
  
  // Step 2: Determine impact driver
  const { driver, driverScore } = determineImpactDriver(
    recommendation.themeCategory,
    recommendation.severity
  );
  
  // Step 3: Get theme economic weights
  const themeWeights = getThemeEconomicWeights(
    recommendation.themeCategory,
    economicParams
  );
  
  // Step 4: Calculate baseline monthly revenue
  const monthlyRevenue = calculateMonthlyRevenue(baselineMetrics);
  
  if (monthlyRevenue === null) {
    caveats.push('Monthly revenue could not be calculated - missing baseline metrics');
  }
  
  // Step 5: Calculate rating impact from this issue
  const ratingImpact = SEVERITY_RATING_IMPACT[recommendation.severity];
  const severityMultiplier = SEVERITY_MULTIPLIERS[recommendation.severity];
  
  steps.push({
    step: 1,
    description: 'Determine rating impact based on severity',
    formula: 'ratingImpact = SEVERITY_RATING_IMPACT[severity]',
    inputs: { severity: recommendation.severity },
    result: ratingImpact,
  });
  
  // Step 6: Calculate revenue impact range
  let revenueAtRisk: ValueRange | null = null;
  let revenueUpside: ValueRange | null = null;
  
  if (monthlyRevenue !== null && dataQuality.score >= 0.3) {
    const elasticityRange = economicParams.rating_to_revenue_elasticity;
    
    // Revenue at risk = monthly_revenue × rating_impact × elasticity × theme_weight × severity_multiplier
    const revenueAtRiskMin = monthlyRevenue * ratingImpact * elasticityRange.min * 
      themeWeights.revenue * severityMultiplier;
    const revenueAtRiskMax = monthlyRevenue * ratingImpact * elasticityRange.max * 
      themeWeights.revenue * severityMultiplier;
    
    revenueAtRisk = {
      min: Math.round(revenueAtRiskMin),
      max: Math.round(revenueAtRiskMax),
      mid: Math.round((revenueAtRiskMin + revenueAtRiskMax) / 2),
    };
    
    steps.push({
      step: 2,
      description: 'Calculate revenue at risk range',
      formula: 'revenue × ratingImpact × elasticity × themeWeight × severityMultiplier',
      inputs: {
        monthlyRevenue,
        ratingImpact,
        elasticityMin: elasticityRange.min,
        elasticityMax: elasticityRange.max,
        themeWeight: themeWeights.revenue,
        severityMultiplier,
      },
      result: `${revenueAtRisk.min} - ${revenueAtRisk.max}`,
    });
    
    // Revenue upside = same calculation (what you'd gain by fixing)
    // But scale by mention volume as proxy for issue prevalence
    const mentionScaleFactor = calculateMentionScaleFactor(
      recommendation.negativeCount + recommendation.neutralCount,
      recommendation.mentionCount
    );
    
    const revenueUpsideMin = revenueAtRiskMin * mentionScaleFactor;
    const revenueUpsideMax = revenueAtRiskMax * mentionScaleFactor;
    
    revenueUpside = {
      min: Math.round(revenueUpsideMin),
      max: Math.round(revenueUpsideMax),
      mid: Math.round((revenueUpsideMin + revenueUpsideMax) / 2),
    };
    
    steps.push({
      step: 3,
      description: 'Calculate revenue upside (adjusted by mention scale)',
      formula: 'revenueAtRisk × mentionScaleFactor',
      inputs: {
        revenueAtRiskMid: revenueAtRisk.mid,
        mentionScaleFactor,
        nonPositiveMentions: recommendation.negativeCount + recommendation.neutralCount,
        totalMentions: recommendation.mentionCount,
      },
      result: `${revenueUpside.min} - ${revenueUpside.max}`,
    });
  } else {
    caveats.push('Revenue calculations skipped due to insufficient data quality');
  }
  
  // Step 7: Calculate footfall impact
  let footfallAtRisk: { min: number; max: number } | null = null;
  let footfallUpside: { min: number; max: number } | null = null;
  
  if (baselineMetrics?.coversPerMonth && dataQuality.score >= 0.3) {
    const coversPerMonth = baselineMetrics.coversPerMonth;
    const clickElasticity = economicParams.rating_to_click_elasticity;
    const conversionRate = economicParams.click_to_visit_conversion_rate;
    
    // Footfall at risk = covers × rating_impact × click_elasticity × conversion_rate × theme_weight
    const footfallAtRiskMin = Math.round(
      coversPerMonth * ratingImpact * clickElasticity.min * 
      conversionRate * themeWeights.footfall * severityMultiplier
    );
    const footfallAtRiskMax = Math.round(
      coversPerMonth * ratingImpact * clickElasticity.max * 
      conversionRate * themeWeights.footfall * severityMultiplier
    );
    
    footfallAtRisk = { min: footfallAtRiskMin, max: footfallAtRiskMax };
    
    const mentionScaleFactor = calculateMentionScaleFactor(
      recommendation.negativeCount + recommendation.neutralCount,
      recommendation.mentionCount
    );
    
    footfallUpside = {
      min: Math.round(footfallAtRiskMin * mentionScaleFactor),
      max: Math.round(footfallAtRiskMax * mentionScaleFactor),
    };
    
    steps.push({
      step: 4,
      description: 'Calculate footfall impact range',
      formula: 'covers × ratingImpact × clickElasticity × conversionRate × themeWeight',
      inputs: {
        coversPerMonth,
        ratingImpact,
        clickElasticityMin: clickElasticity.min,
        clickElasticityMax: clickElasticity.max,
        conversionRate,
        themeWeight: themeWeights.footfall,
      },
      result: `At risk: ${footfallAtRisk.min}-${footfallAtRisk.max}, Upside: ${footfallUpside.min}-${footfallUpside.max}`,
    });
  }
  
  // Step 8: Determine confidence level
  const confidenceLevel = determineConfidenceLevel(dataQuality.score, economicParams);
  
  // Step 9: Build explain payload
  const explainPayload = buildExplainPayload(
    recommendation,
    baselineMetrics,
    economicParams,
    themeWeights,
    monthlyRevenue,
    steps,
    dataQuality,
    confidenceLevel,
    caveats
  );
  
  return {
    recommendationId: recommendation.recommendationId,
    revenueAtRisk,
    revenueUpside,
    footfallAtRisk,
    footfallUpside,
    impactDriver: driver,
    impactDriverScore: driverScore,
    confidenceLevel,
    dataQualityScore: dataQuality.score,
    inputSeverity: recommendation.severity,
    inputMentionCount: recommendation.mentionCount,
    inputSentimentScore: recommendation.sentimentScore,
    inputThemeScore010: recommendation.themeScore010,
    currency: baselineMetrics?.currency ?? 'ZAR',
    explainPayload,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate monthly revenue from baseline metrics
 */
function calculateMonthlyRevenue(metrics: BaselineMetricsInput | null): number | null {
  if (!metrics) return null;
  
  // Method 1: covers × average spend
  if (metrics.coversPerMonth && metrics.averageSpendPerCover) {
    return metrics.coversPerMonth * metrics.averageSpendPerCover;
  }
  
  // Method 2: capacity-based estimation
  if (metrics.seatCapacity && metrics.averageTurnover && 
      metrics.daysOpenPerWeek && metrics.servicesPerDay && 
      metrics.averageSpendPerCover) {
    const coversPerService = metrics.seatCapacity * (metrics.averageTurnover ?? 1);
    const servicesPerMonth = (metrics.daysOpenPerWeek / 7) * 30 * (metrics.servicesPerDay ?? 2);
    const estimatedCovers = coversPerService * servicesPerMonth;
    return estimatedCovers * metrics.averageSpendPerCover;
  }
  
  return null;
}

/**
 * Get theme economic weights from parameters
 */
function getThemeEconomicWeights(
  category: ThemeCategory,
  params: EconomicParameters
): { revenue: number; footfall: number; conversion: number } {
  const weights = params.theme_economic_weights[category];
  
  if (weights) {
    return {
      revenue: weights.revenue_weight,
      footfall: weights.footfall_weight,
      conversion: weights.conversion_weight,
    };
  }
  
  // Default weights if category not found
  return {
    revenue: 1.0,
    footfall: 1.0,
    conversion: 1.0,
  };
}

/**
 * Calculate mention scale factor
 * More mentions = more reliable estimate
 */
function calculateMentionScaleFactor(nonPositiveMentions: number, totalMentions: number): number {
  if (totalMentions === 0) return 0.5;
  
  // Higher ratio of non-positive mentions = higher impact
  const nonPositiveRatio = nonPositiveMentions / totalMentions;
  
  // Scale factor: 0.5 to 1.5 based on mention volume and ratio
  const volumeFactor = Math.min(1.0, Math.log10(nonPositiveMentions + 1) / 2);
  const ratioFactor = 0.5 + nonPositiveRatio;
  
  return Math.min(1.5, volumeFactor * ratioFactor + 0.5);
}

/**
 * Determine primary impact driver based on theme category
 */
function determineImpactDriver(
  category: ThemeCategory,
  severity: RecommendationSeverity
): { driver: ImpactDriverType; driverScore: number } {
  const mapping = THEME_IMPACT_DRIVERS[category] ?? THEME_IMPACT_DRIVERS.OTHER;
  
  // Severity affects confidence in driver assignment
  const severityBoost = {
    CRITICAL: 0.2,
    HIGH: 0.1,
    MEDIUM: 0,
    LOW: -0.1,
  }[severity];
  
  const driverScore = Math.min(1.0, mapping.primaryWeight + severityBoost);
  
  return {
    driver: mapping.primary,
    driverScore,
  };
}

/**
 * Assess data quality for impact calculations
 */
function assessDataQuality(
  recommendation: RecommendationImpactInput,
  baselineMetrics: BaselineMetricsInput | null,
  channelMetrics: ChannelMetricsInput | null,
  params: EconomicParameters
): { score: number; factors: DataQualityFactor[] } {
  const factors: DataQualityFactor[] = [];
  
  // Factor 1: Baseline metrics completeness (weight: 0.4)
  let baselineScore = 0;
  if (baselineMetrics) {
    let fieldsPresent = 0;
    const totalFields = 4;
    if (baselineMetrics.coversPerMonth) fieldsPresent++;
    if (baselineMetrics.averageSpendPerCover) fieldsPresent++;
    if (baselineMetrics.seatCapacity) fieldsPresent++;
    if (baselineMetrics.daysOpenPerWeek) fieldsPresent++;
    baselineScore = fieldsPresent / totalFields;
  }
  factors.push({
    factor: 'Baseline Metrics',
    score: baselineScore,
    weight: 0.4,
    explanation: baselineScore > 0.5 
      ? 'Restaurant baseline metrics are available' 
      : 'Missing restaurant baseline metrics reduces accuracy',
  });
  
  // Factor 2: Review volume (weight: 0.3)
  const minReviews = params.min_data_for_roi_claim.min_reviews;
  const volumeScore = Math.min(1.0, recommendation.mentionCount / minReviews);
  factors.push({
    factor: 'Review Volume',
    score: volumeScore,
    weight: 0.3,
    explanation: volumeScore >= 1.0
      ? `Sufficient review volume (${recommendation.mentionCount} mentions)`
      : `Limited review volume (${recommendation.mentionCount}/${minReviews} minimum)`,
  });
  
  // Factor 3: Theme data quality (weight: 0.2)
  const themeScore = recommendation.themeScore010 !== null ? 0.8 : 0.2;
  factors.push({
    factor: 'Theme Analysis',
    score: themeScore,
    weight: 0.2,
    explanation: themeScore > 0.5
      ? 'Theme sentiment data is available'
      : 'Limited theme analysis data',
  });
  
  // Factor 4: Channel metrics (weight: 0.1) - optional boost
  let channelScore = 0.5; // Neutral if no channel data
  if (channelMetrics) {
    let fieldsPresent = 0;
    if (channelMetrics.websiteClicks) fieldsPresent++;
    if (channelMetrics.directionsRequests) fieldsPresent++;
    if (channelMetrics.phoneCalls) fieldsPresent++;
    channelScore = fieldsPresent > 0 ? 0.8 : 0.5;
  }
  factors.push({
    factor: 'Channel Metrics',
    score: channelScore,
    weight: 0.1,
    explanation: channelScore > 0.5
      ? 'Google Business Profile data available'
      : 'No channel metrics available',
  });
  
  // Calculate weighted score
  const totalScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  
  return { score: totalScore, factors };
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidenceLevel(
  dataQualityScore: number,
  params: EconomicParameters
): ConfidenceLevelType {
  const thresholds = params.confidence_display_thresholds;
  
  if (dataQualityScore >= thresholds.high) {
    return 'HIGH';
  } else if (dataQualityScore >= thresholds.medium) {
    return 'MEDIUM';
  } else if (dataQualityScore >= 0.3) {
    return 'LOW';
  } else {
    return 'INSUFFICIENT_DATA';
  }
}

/**
 * Build detailed explain payload
 */
function buildExplainPayload(
  recommendation: RecommendationImpactInput,
  baselineMetrics: BaselineMetricsInput | null,
  params: EconomicParameters,
  themeWeights: { revenue: number; footfall: number; conversion: number },
  monthlyRevenue: number | null,
  steps: CalculationStep[],
  dataQuality: { score: number; factors: DataQualityFactor[] },
  confidenceLevel: ConfidenceLevelType,
  caveats: string[]
): ExplainPayload {
  // Generate summary based on confidence
  let summary: string;
  switch (confidenceLevel) {
    case 'HIGH':
      summary = `High-confidence estimate based on comprehensive restaurant data and ${recommendation.mentionCount} theme mentions.`;
      break;
    case 'MEDIUM':
      summary = `Moderate-confidence estimate. Some baseline data available with ${recommendation.mentionCount} theme mentions.`;
      break;
    case 'LOW':
      summary = `Low-confidence estimate due to limited data. Results should be treated as directional guidance only.`;
      break;
    default:
      summary = `Insufficient data for reliable estimates. Add baseline metrics to enable impact calculations.`;
  }
  
  // Generate confidence explanation
  const confidenceExplanation = generateConfidenceExplanation(dataQuality.factors);
  
  // Add standard caveats
  const allCaveats = [
    ...caveats,
    'Estimates are based on industry research and may vary by market',
    'Actual impact depends on competitive factors and market conditions',
    'Revenue projections assume consistent operational performance',
  ];
  
  return {
    summary,
    parametersUsed: {
      ratingToRevenueElasticity: params.rating_to_revenue_elasticity,
      ratingToClickElasticity: params.rating_to_click_elasticity,
      clickToVisitConversionRate: params.click_to_visit_conversion_rate,
      themeEconomicWeight: themeWeights,
    },
    baselineDataUsed: {
      monthlyRevenue,
      coversPerMonth: baselineMetrics?.coversPerMonth ?? null,
      averageSpend: baselineMetrics?.averageSpendPerCover ?? null,
      source: baselineMetrics ? 'restaurant_baseline_metrics' : 'none',
    },
    calculationSteps: steps,
    dataQualityFactors: dataQuality.factors,
    confidenceExplanation,
    caveats: allCaveats,
  };
}

/**
 * Generate human-readable confidence explanation
 */
function generateConfidenceExplanation(factors: DataQualityFactor[]): string {
  const lowFactors = factors.filter(f => f.score < 0.5);
  const highFactors = factors.filter(f => f.score >= 0.8);
  
  const parts: string[] = [];
  
  if (highFactors.length > 0) {
    parts.push(`Strengths: ${highFactors.map(f => f.factor.toLowerCase()).join(', ')}`);
  }
  
  if (lowFactors.length > 0) {
    parts.push(`Limitations: ${lowFactors.map(f => f.factor.toLowerCase()).join(', ')}`);
  }
  
  return parts.join('. ') || 'Standard confidence based on available data.';
}

// ============================================================
// BATCH CALCULATION
// ============================================================

/**
 * Calculate economic impacts for multiple recommendations
 */
export function calculateBatchRecommendationImpacts(
  recommendations: RecommendationImpactInput[],
  baselineMetrics: BaselineMetricsInput | null,
  channelMetrics: ChannelMetricsInput | null,
  economicParams: EconomicParameters
): RecommendationEconomicImpactResult[] {
  return recommendations.map(rec => 
    calculateRecommendationImpact(rec, baselineMetrics, channelMetrics, economicParams)
  );
}

/**
 * Calculate aggregate impact across all recommendations
 */
export function calculateAggregateImpact(
  impacts: RecommendationEconomicImpactResult[]
): {
  totalRevenueAtRisk: ValueRange | null;
  totalRevenueUpside: ValueRange | null;
  totalFootfallAtRisk: { min: number; max: number } | null;
  totalFootfallUpside: { min: number; max: number } | null;
  averageConfidence: ConfidenceLevelType;
} {
  // Filter to impacts with revenue data
  const withRevenue = impacts.filter(i => i.revenueAtRisk !== null);
  
  if (withRevenue.length === 0) {
    return {
      totalRevenueAtRisk: null,
      totalRevenueUpside: null,
      totalFootfallAtRisk: null,
      totalFootfallUpside: null,
      averageConfidence: 'INSUFFICIENT_DATA',
    };
  }
  
  // Sum revenue impacts
  const totalRevenueAtRisk = {
    min: withRevenue.reduce((sum, i) => sum + (i.revenueAtRisk?.min ?? 0), 0),
    max: withRevenue.reduce((sum, i) => sum + (i.revenueAtRisk?.max ?? 0), 0),
    mid: withRevenue.reduce((sum, i) => sum + (i.revenueAtRisk?.mid ?? 0), 0),
  };
  
  const totalRevenueUpside = {
    min: withRevenue.reduce((sum, i) => sum + (i.revenueUpside?.min ?? 0), 0),
    max: withRevenue.reduce((sum, i) => sum + (i.revenueUpside?.max ?? 0), 0),
    mid: withRevenue.reduce((sum, i) => sum + (i.revenueUpside?.mid ?? 0), 0),
  };
  
  // Sum footfall impacts
  const withFootfall = impacts.filter(i => i.footfallAtRisk !== null);
  const totalFootfallAtRisk = withFootfall.length > 0 ? {
    min: withFootfall.reduce((sum, i) => sum + (i.footfallAtRisk?.min ?? 0), 0),
    max: withFootfall.reduce((sum, i) => sum + (i.footfallAtRisk?.max ?? 0), 0),
  } : null;
  
  const totalFootfallUpside = withFootfall.length > 0 ? {
    min: withFootfall.reduce((sum, i) => sum + (i.footfallUpside?.min ?? 0), 0),
    max: withFootfall.reduce((sum, i) => sum + (i.footfallUpside?.max ?? 0), 0),
  } : null;
  
  // Average confidence
  const avgQuality = impacts.reduce((sum, i) => sum + i.dataQualityScore, 0) / impacts.length;
  const averageConfidence: ConfidenceLevelType = 
    avgQuality >= 0.8 ? 'HIGH' :
    avgQuality >= 0.5 ? 'MEDIUM' :
    avgQuality >= 0.3 ? 'LOW' : 'INSUFFICIENT_DATA';
  
  return {
    totalRevenueAtRisk,
    totalRevenueUpside,
    totalFootfallAtRisk,
    totalFootfallUpside,
    averageConfidence,
  };
}
