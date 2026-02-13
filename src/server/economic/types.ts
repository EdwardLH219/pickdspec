/**
 * Economic Impact Engine Types
 * 
 * Types for calculating and explaining revenue/footfall impacts per recommendation.
 */

import type { RecommendationSeverity, ThemeCategory } from '@prisma/client';

// ============================================================
// IMPACT CALCULATION INPUTS
// ============================================================

/**
 * Baseline metrics for a restaurant (from RestaurantBaselineMetrics)
 */
export interface BaselineMetricsInput {
  coversPerMonth: number | null;
  seatCapacity: number | null;
  averageTurnover: number | null;
  averageSpendPerCover: number | null;
  averageOrderValue: number | null;
  currency: string;
  daysOpenPerWeek: number | null;
  servicesPerDay: number | null;
  confidenceLevel: number | null;
}

/**
 * Channel metrics input (from ChannelMetrics)
 */
export interface ChannelMetricsInput {
  websiteClicks: number | null;
  directionsRequests: number | null;
  phoneCalls: number | null;
  searchViews: number | null;
  mapViews: number | null;
}

/**
 * Theme data for impact calculation
 */
export interface ThemeImpactInput {
  themeId: string;
  themeName: string;
  themeCategory: ThemeCategory;
  mentionCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveCount: number;
  sentimentScore: number;  // -1 to 1
  themeScore010: number;   // 0 to 10
}

/**
 * Recommendation data for impact calculation
 */
export interface RecommendationImpactInput {
  recommendationId: string;
  severity: RecommendationSeverity;
  themeId: string | null;
  themeName: string;
  themeCategory: ThemeCategory;
  mentionCount: number;
  negativeCount: number;
  neutralCount: number;
  sentimentScore: number;
  themeScore010: number;
}

// ============================================================
// IMPACT CALCULATION OUTPUTS
// ============================================================

/**
 * Impact driver classification
 */
export type ImpactDriverType = 'ACQUISITION' | 'CONVERSION' | 'RETENTION';

/**
 * Confidence level for estimates
 */
export type ConfidenceLevelType = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

/**
 * Range with min/max values
 */
export interface ValueRange {
  min: number;
  max: number;
  mid: number;
}

/**
 * Calculated economic impact for a recommendation
 */
export interface RecommendationEconomicImpactResult {
  recommendationId: string;
  
  // Revenue at Risk: monthly revenue being lost due to this issue
  revenueAtRisk: ValueRange | null;
  
  // Revenue Upside: potential monthly gain if issue is fixed
  revenueUpside: ValueRange | null;
  
  // Footfall impact
  footfallAtRisk: { min: number; max: number } | null;
  footfallUpside: { min: number; max: number } | null;
  
  // Impact classification
  impactDriver: ImpactDriverType;
  impactDriverScore: number;  // 0-1 confidence in classification
  
  // Confidence
  confidenceLevel: ConfidenceLevelType;
  dataQualityScore: number;  // 0-1
  
  // Inputs used (for audit)
  inputSeverity: RecommendationSeverity;
  inputMentionCount: number;
  inputSentimentScore: number | null;
  inputThemeScore010: number | null;
  
  currency: string;
  
  // Explain payload
  explainPayload: ExplainPayload;
}

// ============================================================
// EXPLAIN PAYLOAD
// ============================================================

/**
 * Detailed explanation of how the impact was calculated
 */
export interface ExplainPayload {
  // Calculation summary
  summary: string;
  
  // Parameters used
  parametersUsed: {
    ratingToRevenueElasticity: { min: number; max: number };
    ratingToClickElasticity: { min: number; max: number };
    clickToVisitConversionRate: number;
    themeEconomicWeight: {
      revenue: number;
      footfall: number;
      conversion: number;
    };
  };
  
  // Baseline data used
  baselineDataUsed: {
    monthlyRevenue: number | null;
    coversPerMonth: number | null;
    averageSpend: number | null;
    source: string;
  };
  
  // Calculation steps
  calculationSteps: CalculationStep[];
  
  // Data quality breakdown
  dataQualityFactors: DataQualityFactor[];
  
  // Confidence explanation
  confidenceExplanation: string;
  
  // Caveats and limitations
  caveats: string[];
}

/**
 * Individual calculation step for transparency
 */
export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number | string;
}

/**
 * Factor affecting data quality score
 */
export interface DataQualityFactor {
  factor: string;
  score: number;  // 0-1
  weight: number; // How much this factor affects overall score
  explanation: string;
}

// ============================================================
// SEVERITY MULTIPLIERS
// ============================================================

/**
 * Severity-based multipliers for impact calculation
 * Higher severity = larger portion of potential impact is at risk
 */
export const SEVERITY_MULTIPLIERS: Record<RecommendationSeverity, number> = {
  CRITICAL: 1.0,   // Full impact - urgent issue
  HIGH: 0.75,      // 75% of potential impact
  MEDIUM: 0.50,    // 50% of potential impact
  LOW: 0.25,       // 25% of potential impact
};

/**
 * Severity to rating impact mapping
 * Estimates how much the issue is dragging down the effective rating
 */
export const SEVERITY_RATING_IMPACT: Record<RecommendationSeverity, number> = {
  CRITICAL: 1.5,   // Issue is costing ~1.5 rating points
  HIGH: 1.0,       // Issue is costing ~1.0 rating points
  MEDIUM: 0.5,     // Issue is costing ~0.5 rating points
  LOW: 0.25,       // Issue is costing ~0.25 rating points
};

// ============================================================
// THEME CATEGORY TO IMPACT DRIVER MAPPING
// ============================================================

/**
 * Maps theme categories to their primary impact driver
 * This determines whether the issue mainly affects acquisition, conversion, or retention
 */
export const THEME_IMPACT_DRIVERS: Record<ThemeCategory, {
  primary: ImpactDriverType;
  secondary: ImpactDriverType | null;
  primaryWeight: number;
}> = {
  PRODUCT: {
    primary: 'RETENTION',
    secondary: 'ACQUISITION',
    primaryWeight: 0.7,
  },
  SERVICE: {
    primary: 'RETENTION',
    secondary: 'ACQUISITION',
    primaryWeight: 0.8,
  },
  VALUE: {
    primary: 'CONVERSION',
    secondary: 'RETENTION',
    primaryWeight: 0.6,
  },
  AMBIANCE: {
    primary: 'CONVERSION',
    secondary: 'ACQUISITION',
    primaryWeight: 0.7,
  },
  CLEANLINESS: {
    primary: 'RETENTION',
    secondary: 'CONVERSION',
    primaryWeight: 0.9,
  },
  LOCATION: {
    primary: 'ACQUISITION',
    secondary: null,
    primaryWeight: 0.8,
  },
  OTHER: {
    primary: 'RETENTION',
    secondary: null,
    primaryWeight: 0.5,
  },
};
