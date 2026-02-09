/**
 * Scoring Calculations Tests
 * 
 * Tests for:
 * - Bounds validation for all score components
 * - Determinism (same inputs produce same outputs)
 * - Edge cases and formula correctness
 */

import { describe, it, expect } from 'vitest';
import { SourceType } from '@prisma/client';
import {
  calculateTimeWeight,
  calculateSourceWeight,
  calculateEngagementWeight,
  calculateWeightedImpact,
  calculateThemeSentiment,
  calculateThemeScore010,
  calculateSeverity,
  aggregateThemeScores,
  SCORE_BOUNDS,
} from '../calculations';
import type { ParameterSet } from '@/server/parameters/types';

// ============================================================
// TEST FIXTURES
// ============================================================

const createTestParams = (overrides: Partial<ParameterSet> = {}): ParameterSet => ({
  sentiment: {
    model_version: 'test-1.0',
    use_star_rating: true,
    language_handling_mode: 'multilingual_model',
    star_rating_blend_weight: 0.3,
  },
  time: {
    review_half_life_days: 60,
    ...overrides.time,
  },
  source: {
    weights: {
      google: 1.2,
      hellopeter: 1.15,
      tripadvisor: 1.0,
      facebook: 0.9,
      yelp: 1.0,
      zomato: 1.0,
      opentable: 0.9,
      website: 0.8,
      instagram: 0.8,
      twitter: 0.7,
    },
    min_weight: 0.6,
    max_weight: 1.4,
    ...overrides.source,
  },
  engagement: {
    enabled_by_source: {
      google: true,
      facebook: true,
      tripadvisor: true,
      hellopeter: false,
    },
    cap: 1.3,
    ...overrides.engagement,
  },
  confidence: {
    rules_version: '1.0.0',
    min_text_length_chars: 20,
    duplicate_similarity_threshold: 0.85,
    low_confidence_floor: 0.6,
    vague_review_weight: 0.7,
    duplicate_review_weight: 0.6,
    ...overrides.confidence,
  },
  fix_tracking: {
    pre_window_days: 30,
    post_window_days: 30,
    min_reviews_for_inference: 5,
    confidence_thresholds: { high: 10, medium: 5, low: 2 },
    ...overrides.fix_tracking,
  },
  ...overrides,
});

// ============================================================
// TIME WEIGHT TESTS
// ============================================================

describe('calculateTimeWeight', () => {
  describe('Bounds', () => {
    it('should return value in range (0, 1]', () => {
      const asOfDate = new Date('2024-01-01');
      
      // Test various days in the past
      for (const daysAgo of [0, 1, 7, 30, 60, 90, 180, 365]) {
        const reviewDate = new Date(asOfDate);
        reviewDate.setDate(reviewDate.getDate() - daysAgo);
        
        const result = calculateTimeWeight(reviewDate, asOfDate, 60);
        
        expect(result.value).toBeGreaterThan(0);
        expect(result.value).toBeLessThanOrEqual(1);
      }
    });
    
    it('should return 1.0 for review on asOfDate', () => {
      const date = new Date('2024-01-01');
      const result = calculateTimeWeight(date, date, 60);
      
      expect(result.value).toBe(1.0);
      expect(result.daysDelta).toBe(0);
    });
    
    it('should return ~0.5 at half-life days', () => {
      const asOfDate = new Date('2024-03-01');
      const reviewDate = new Date('2024-01-01'); // 60 days ago
      
      const result = calculateTimeWeight(reviewDate, asOfDate, 60);
      
      // At half-life, should be approximately 0.5
      expect(result.value).toBeCloseTo(0.5, 1);
      expect(result.daysDelta).toBe(60);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const reviewDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-02-01');
      
      const result1 = calculateTimeWeight(reviewDate, asOfDate, 60);
      const result2 = calculateTimeWeight(reviewDate, asOfDate, 60);
      
      expect(result1.value).toBe(result2.value);
      expect(result1.daysDelta).toBe(result2.daysDelta);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should decay exponentially with time', () => {
      const asOfDate = new Date('2024-01-01');
      
      const day0 = calculateTimeWeight(new Date('2024-01-01'), asOfDate, 60);
      const day30 = calculateTimeWeight(new Date('2023-12-02'), asOfDate, 60);
      const day60 = calculateTimeWeight(new Date('2023-11-02'), asOfDate, 60);
      
      // Each half-life should halve the weight
      expect(day0.value).toBeGreaterThan(day30.value);
      expect(day30.value).toBeGreaterThan(day60.value);
      
      // Ratio should be consistent
      const ratio1 = day30.value / day0.value;
      const ratio2 = day60.value / day30.value;
      expect(ratio1).toBeCloseTo(ratio2, 1);
    });
    
    it('should handle different half-life values', () => {
      const reviewDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-02-01');
      
      const shortHalfLife = calculateTimeWeight(reviewDate, asOfDate, 30);
      const longHalfLife = calculateTimeWeight(reviewDate, asOfDate, 90);
      
      // Shorter half-life = faster decay = lower weight
      expect(shortHalfLife.value).toBeLessThan(longHalfLife.value);
    });
  });
});

// ============================================================
// SOURCE WEIGHT TESTS
// ============================================================

describe('calculateSourceWeight', () => {
  describe('Bounds', () => {
    it('should clamp to [min_weight, max_weight]', () => {
      const params = createTestParams({
        source: {
          weights: { google: 2.0 }, // Above max
          min_weight: 0.6,
          max_weight: 1.4,
        },
      });
      
      const result = calculateSourceWeight(SourceType.GOOGLE, params);
      
      expect(result.value).toBe(1.4);
      expect(result.clamped).toBe(true);
    });
    
    it('should clamp values below minimum', () => {
      const params = createTestParams({
        source: {
          weights: { twitter: 0.1 }, // Below min
          min_weight: 0.6,
          max_weight: 1.4,
        },
      });
      
      const result = calculateSourceWeight(SourceType.TWITTER, params);
      
      expect(result.value).toBe(0.6);
      expect(result.clamped).toBe(true);
    });
    
    it('should not clamp values within bounds', () => {
      const params = createTestParams();
      const result = calculateSourceWeight(SourceType.GOOGLE, params);
      
      expect(result.value).toBe(1.2);
      expect(result.clamped).toBe(false);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const params = createTestParams();
      
      const result1 = calculateSourceWeight(SourceType.GOOGLE, params);
      const result2 = calculateSourceWeight(SourceType.GOOGLE, params);
      
      expect(result1.value).toBe(result2.value);
    });
  });
  
  describe('Default Handling', () => {
    it('should return 1.0 for unknown source types', () => {
      const params = createTestParams({
        source: {
          weights: {}, // No weights defined
          min_weight: 0.6,
          max_weight: 1.4,
        },
      });
      
      const result = calculateSourceWeight(SourceType.GOOGLE, params);
      
      expect(result.rawWeight).toBe(1.0);
    });
  });
});

// ============================================================
// ENGAGEMENT WEIGHT TESTS
// ============================================================

describe('calculateEngagementWeight', () => {
  describe('Bounds', () => {
    it('should return value in range [1, cap]', () => {
      const params = createTestParams();
      
      // Test various engagement levels
      for (const likes of [0, 1, 5, 10, 100, 1000]) {
        const result = calculateEngagementWeight(likes, 0, 0, SourceType.GOOGLE, params);
        
        expect(result.value).toBeGreaterThanOrEqual(1);
        expect(result.value).toBeLessThanOrEqual(params.engagement.cap);
      }
    });
    
    it('should cap at max value', () => {
      const params = createTestParams({ engagement: { enabled_by_source: { google: true }, cap: 1.3 } });
      
      const result = calculateEngagementWeight(10000, 10000, 10000, SourceType.GOOGLE, params);
      
      expect(result.value).toBe(1.3);
      expect(result.capped).toBe(true);
    });
    
    it('should return 1.0 when engagement disabled', () => {
      const params = createTestParams({ 
        engagement: { enabled_by_source: { google: false }, cap: 1.3 } 
      });
      
      const result = calculateEngagementWeight(100, 50, 25, SourceType.GOOGLE, params);
      
      expect(result.value).toBe(1.0);
      expect(result.enabled).toBe(false);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const params = createTestParams();
      
      const result1 = calculateEngagementWeight(10, 5, 3, SourceType.GOOGLE, params);
      const result2 = calculateEngagementWeight(10, 5, 3, SourceType.GOOGLE, params);
      
      expect(result1.value).toBe(result2.value);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should increase logarithmically with engagement', () => {
      const params = createTestParams();
      
      const low = calculateEngagementWeight(1, 0, 0, SourceType.GOOGLE, params);
      const medium = calculateEngagementWeight(10, 0, 0, SourceType.GOOGLE, params);
      const high = calculateEngagementWeight(100, 0, 0, SourceType.GOOGLE, params);
      
      // Use raw values to test growth pattern (before cap)
      expect(low.rawValue).toBeLessThan(medium.rawValue);
      expect(medium.rawValue).toBeLessThan(high.rawValue);
      
      // Growth should slow down (logarithmic)
      const growth1 = medium.rawValue - low.rawValue;
      const growth2 = high.rawValue - medium.rawValue;
      expect(growth2).toBeLessThan(growth1 * 2); // Sublinear growth
    });
    
    it('should combine likes, replies, and helpful votes', () => {
      const params = createTestParams();
      
      const likesOnly = calculateEngagementWeight(10, 0, 0, SourceType.GOOGLE, params);
      const allEngagement = calculateEngagementWeight(10, 5, 3, SourceType.GOOGLE, params);
      
      expect(allEngagement.rawValue).toBeGreaterThan(likesOnly.rawValue);
    });
  });
});

// ============================================================
// WEIGHTED IMPACT TESTS
// ============================================================

describe('calculateWeightedImpact', () => {
  describe('Bounds', () => {
    it('should be within expected range for valid inputs', () => {
      // Max positive: 1 * 1 * 1.4 * 1.3 * 1 = 1.82
      const maxPositive = calculateWeightedImpact(1, 1, 1.4, 1.3, 1);
      expect(maxPositive).toBeLessThanOrEqual(2);
      
      // Max negative: -1 * 1 * 1.4 * 1.3 * 1 = -1.82
      const maxNegative = calculateWeightedImpact(-1, 1, 1.4, 1.3, 1);
      expect(maxNegative).toBeGreaterThanOrEqual(-2);
    });
    
    it('should be zero when any weight is zero', () => {
      expect(calculateWeightedImpact(0.5, 1, 1, 1, 0)).toBe(0);
      expect(calculateWeightedImpact(0, 1, 1, 1, 1)).toBe(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = calculateWeightedImpact(0.5, 0.8, 1.2, 1.1, 0.9);
      const result2 = calculateWeightedImpact(0.5, 0.8, 1.2, 1.1, 0.9);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should multiply all components', () => {
      const result = calculateWeightedImpact(0.5, 0.5, 2, 2, 0.5);
      
      // 0.5 * 0.5 * 2 * 2 * 0.5 = 0.5
      expect(result).toBe(0.5);
    });
    
    it('should preserve sentiment sign', () => {
      const positive = calculateWeightedImpact(0.8, 0.9, 1.2, 1.1, 1.0);
      const negative = calculateWeightedImpact(-0.8, 0.9, 1.2, 1.1, 1.0);
      
      expect(positive).toBeGreaterThan(0);
      expect(negative).toBeLessThan(0);
      expect(Math.abs(positive)).toBeCloseTo(Math.abs(negative), 10);
    });
  });
});

// ============================================================
// THEME SENTIMENT TESTS
// ============================================================

describe('calculateThemeSentiment', () => {
  describe('Bounds', () => {
    it('should return value in range [-1, +1]', () => {
      // All positive
      const allPositive = calculateThemeSentiment([1, 0.8, 0.5, 0.3]);
      expect(allPositive.sentiment).toBeGreaterThanOrEqual(-1);
      expect(allPositive.sentiment).toBeLessThanOrEqual(1);
      
      // All negative
      const allNegative = calculateThemeSentiment([-1, -0.8, -0.5, -0.3]);
      expect(allNegative.sentiment).toBeGreaterThanOrEqual(-1);
      expect(allNegative.sentiment).toBeLessThanOrEqual(1);
      
      // Mixed
      const mixed = calculateThemeSentiment([1, -1, 0.5, -0.5]);
      expect(mixed.sentiment).toBeGreaterThanOrEqual(-1);
      expect(mixed.sentiment).toBeLessThanOrEqual(1);
    });
    
    it('should return 0 for empty array', () => {
      const result = calculateThemeSentiment([]);
      
      expect(result.sentiment).toBe(0);
      expect(result.sumWr).toBe(0);
      expect(result.sumAbsWr).toBe(0);
    });
    
    it('should return 0 when all impacts are zero', () => {
      const result = calculateThemeSentiment([0, 0, 0]);
      
      expect(result.sentiment).toBe(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const impacts = [0.5, -0.3, 0.8, -0.2];
      
      const result1 = calculateThemeSentiment(impacts);
      const result2 = calculateThemeSentiment(impacts);
      
      expect(result1.sentiment).toBe(result2.sentiment);
    });
    
    it('should be order-independent', () => {
      const impacts1 = [0.5, -0.3, 0.8, -0.2];
      const impacts2 = [-0.3, 0.8, -0.2, 0.5]; // Same values, different order
      
      const result1 = calculateThemeSentiment(impacts1);
      const result2 = calculateThemeSentiment(impacts2);
      
      expect(result1.sentiment).toBe(result2.sentiment);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should return 1 for all positive impacts', () => {
      const result = calculateThemeSentiment([1, 1, 1]);
      
      // ΣW_r / Σ|W_r| = 3 / 3 = 1
      expect(result.sentiment).toBe(1);
    });
    
    it('should return -1 for all negative impacts', () => {
      const result = calculateThemeSentiment([-1, -1, -1]);
      
      // ΣW_r / Σ|W_r| = -3 / 3 = -1
      expect(result.sentiment).toBe(-1);
    });
    
    it('should return 0 for balanced impacts', () => {
      const result = calculateThemeSentiment([1, -1, 0.5, -0.5]);
      
      // ΣW_r / Σ|W_r| = 0 / 3 = 0
      expect(result.sentiment).toBe(0);
    });
    
    it('should correctly calculate sum values', () => {
      const result = calculateThemeSentiment([0.5, -0.3, 0.2]);
      
      expect(result.sumWr).toBe(0.5 + (-0.3) + 0.2);
      expect(result.sumAbsWr).toBe(0.5 + 0.3 + 0.2);
    });
  });
});

// ============================================================
// THEME SCORE 0-10 TESTS
// ============================================================

describe('calculateThemeScore010', () => {
  describe('Bounds', () => {
    it('should return value in range [0, 10]', () => {
      for (const sentiment of [-1, -0.5, 0, 0.5, 1]) {
        const score = calculateThemeScore010(sentiment);
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });
    
    it('should clamp out-of-bounds inputs', () => {
      expect(calculateThemeScore010(-2)).toBe(0);
      expect(calculateThemeScore010(2)).toBe(10);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = calculateThemeScore010(0.5);
      const result2 = calculateThemeScore010(0.5);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should return 0 for sentiment -1', () => {
      expect(calculateThemeScore010(-1)).toBe(0);
    });
    
    it('should return 5 for sentiment 0', () => {
      expect(calculateThemeScore010(0)).toBe(5);
    });
    
    it('should return 10 for sentiment 1', () => {
      expect(calculateThemeScore010(1)).toBe(10);
    });
    
    it('should scale linearly', () => {
      expect(calculateThemeScore010(-0.5)).toBe(2.5);
      expect(calculateThemeScore010(0.5)).toBe(7.5);
    });
  });
});

// ============================================================
// SEVERITY TESTS
// ============================================================

describe('calculateSeverity', () => {
  describe('Bounds', () => {
    it('should return non-negative value', () => {
      for (const sentiment of [-1, -0.5, 0, 0.5, 1]) {
        for (const mentions of [0, 1, 10, 100]) {
          const severity = calculateSeverity(sentiment, mentions);
          
          expect(severity).toBeGreaterThanOrEqual(0);
        }
      }
    });
    
    it('should return 0 for positive sentiment', () => {
      expect(calculateSeverity(0.5, 100)).toBe(0);
      expect(calculateSeverity(1, 1000)).toBe(0);
    });
    
    it('should return 0 for zero mentions', () => {
      expect(calculateSeverity(-1, 0)).toBe(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = calculateSeverity(-0.7, 50);
      const result2 = calculateSeverity(-0.7, 50);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should increase with more negative sentiment', () => {
      const mild = calculateSeverity(-0.3, 10);
      const severe = calculateSeverity(-0.9, 10);
      
      expect(severe).toBeGreaterThan(mild);
    });
    
    it('should increase logarithmically with mentions', () => {
      const few = calculateSeverity(-0.5, 10);
      const many = calculateSeverity(-0.5, 100);
      
      expect(many).toBeGreaterThan(few);
      
      // Growth should be logarithmic, not linear
      const growth1 = calculateSeverity(-0.5, 100) - calculateSeverity(-0.5, 10);
      const growth2 = calculateSeverity(-0.5, 1000) - calculateSeverity(-0.5, 100);
      
      expect(growth2).toBeLessThan(growth1 * 2);
    });
  });
});

// ============================================================
// THEME AGGREGATION TESTS
// ============================================================

describe('aggregateThemeScores', () => {
  describe('Aggregation Correctness', () => {
    it('should correctly count sentiments', () => {
      const result = aggregateThemeScores({
        themeId: 'theme-1',
        reviewScores: [
          { weightedImpact: 0.5, sentiment: 'positive' },
          { weightedImpact: 0.3, sentiment: 'positive' },
          { weightedImpact: -0.2, sentiment: 'negative' },
          { weightedImpact: 0.1, sentiment: 'neutral' },
        ],
      });
      
      expect(result.mentionCount).toBe(4);
      expect(result.positiveCount).toBe(2);
      expect(result.negativeCount).toBe(1);
      expect(result.neutralCount).toBe(1);
    });
    
    it('should calculate all derived values', () => {
      const result = aggregateThemeScores({
        themeId: 'theme-1',
        reviewScores: [
          { weightedImpact: 0.5, sentiment: 'positive' },
          { weightedImpact: -0.5, sentiment: 'negative' },
        ],
      });
      
      expect(result.themeSentiment).toBe(0);
      expect(result.themeScore010).toBe(5);
      expect(result.severity).toBe(0);
    });
    
    it('should handle negative-heavy themes', () => {
      const result = aggregateThemeScores({
        themeId: 'theme-1',
        reviewScores: [
          { weightedImpact: -0.8, sentiment: 'negative' },
          { weightedImpact: -0.6, sentiment: 'negative' },
          { weightedImpact: -0.4, sentiment: 'negative' },
          { weightedImpact: 0.2, sentiment: 'positive' },
        ],
      });
      
      expect(result.themeSentiment).toBeLessThan(0);
      expect(result.themeScore010).toBeLessThan(5);
      expect(result.severity).toBeGreaterThan(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const input = {
        themeId: 'theme-1',
        reviewScores: [
          { weightedImpact: 0.5, sentiment: 'positive' as const },
          { weightedImpact: -0.3, sentiment: 'negative' as const },
        ],
      };
      
      const result1 = aggregateThemeScores(input);
      const result2 = aggregateThemeScores(input);
      
      expect(result1).toEqual(result2);
    });
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge Cases', () => {
  describe('Empty/Zero Inputs', () => {
    it('should handle zero engagement', () => {
      const params = createTestParams();
      const result = calculateEngagementWeight(0, 0, 0, SourceType.GOOGLE, params);
      
      expect(result.value).toBe(1.0);
    });
    
    it('should handle empty review scores', () => {
      const result = aggregateThemeScores({
        themeId: 'theme-1',
        reviewScores: [],
      });
      
      expect(result.mentionCount).toBe(0);
      expect(result.themeSentiment).toBe(0);
      expect(result.themeScore010).toBe(5);
      expect(result.severity).toBe(0);
    });
  });
  
  describe('Extreme Values', () => {
    it('should handle very old reviews', () => {
      const reviewDate = new Date('2000-01-01');
      const asOfDate = new Date('2024-01-01');
      
      const result = calculateTimeWeight(reviewDate, asOfDate, 60);
      
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThan(0.001); // Very small but not zero
    });
    
    it('should handle very high engagement', () => {
      const params = createTestParams();
      const result = calculateEngagementWeight(1000000, 500000, 250000, SourceType.GOOGLE, params);
      
      expect(result.value).toBe(params.engagement.cap);
    });
    
    it('should handle many review scores for theme', () => {
      const reviewScores = Array.from({ length: 1000 }, (_, i) => ({
        weightedImpact: Math.sin(i) * 0.5, // Oscillating values
        sentiment: Math.sin(i) > 0 ? 'positive' as const : 'negative' as const,
      }));
      
      const result = aggregateThemeScores({
        themeId: 'theme-1',
        reviewScores,
      });
      
      expect(result.themeSentiment).toBeGreaterThanOrEqual(-1);
      expect(result.themeSentiment).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Floating Point Precision', () => {
    it('should handle floating point arithmetic correctly', () => {
      // These values can cause floating point issues
      const result = calculateThemeSentiment([0.1, 0.2, 0.3]);
      
      // Should still be within bounds even with floating point arithmetic
      expect(result.sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.sentiment).toBeLessThanOrEqual(1);
    });
  });
});
