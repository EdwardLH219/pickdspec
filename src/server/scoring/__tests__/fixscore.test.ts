/**
 * FixScore Computation Tests
 * 
 * Tests for:
 * - Delta S calculation and bounds
 * - FixScore formula
 * - Insufficient data handling
 * - Determinism
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDeltaS,
  calculateFixScoreValue,
} from '../fixscore';

// ============================================================
// DELTA S TESTS
// ============================================================

describe('calculateDeltaS', () => {
  describe('Bounds', () => {
    it('should return value in range [-2, +2]', () => {
      // Test various combinations
      const testCases = [
        { baseline: -1, current: 1, expected: 2 },   // Max positive
        { baseline: 1, current: -1, expected: -2 },  // Max negative
        { baseline: 0, current: 0, expected: 0 },    // No change
        { baseline: 0.5, current: 0.8, expected: 0.3 }, // Small improvement
        { baseline: -0.5, current: 0.5, expected: 1 }, // Crossing zero
      ];
      
      for (const { baseline, current, expected } of testCases) {
        const result = calculateDeltaS(baseline, current);
        
        expect(result).toBeGreaterThanOrEqual(-2);
        expect(result).toBeLessThanOrEqual(2);
        expect(result).toBeCloseTo(expected, 10);
      }
    });
    
    it('should clamp extreme values', () => {
      // Even if inputs are out of bounds, result should be clamped
      expect(calculateDeltaS(-2, 2)).toBe(2);
      expect(calculateDeltaS(2, -2)).toBe(-2);
    });
    
    it('should return positive for improvement', () => {
      const result = calculateDeltaS(-0.5, 0.5);
      expect(result).toBeGreaterThan(0);
    });
    
    it('should return negative for decline', () => {
      const result = calculateDeltaS(0.5, -0.5);
      expect(result).toBeLessThan(0);
    });
    
    it('should return 0 for no change', () => {
      const result = calculateDeltaS(0.5, 0.5);
      expect(result).toBe(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = calculateDeltaS(-0.3, 0.7);
      const result2 = calculateDeltaS(-0.3, 0.7);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('Formula Correctness', () => {
    it('should calculate S_after - S_before', () => {
      expect(calculateDeltaS(0.2, 0.8)).toBeCloseTo(0.6, 10);
      expect(calculateDeltaS(-0.2, 0.3)).toBeCloseTo(0.5, 10);
      expect(calculateDeltaS(0.5, 0.1)).toBeCloseTo(-0.4, 10);
    });
  });
});

// ============================================================
// FIX SCORE VALUE TESTS
// ============================================================

describe('calculateFixScoreValue', () => {
  describe('Formula Correctness', () => {
    it('should calculate ΔS × log(1 + review_count) × Confidence', () => {
      // With known values
      const deltaS = 0.5;
      const reviewCount = 9; // log(1 + 9) = log(10) ≈ 2.303
      const confidence = 0.8;
      
      const expected = deltaS * Math.log(10) * confidence;
      const result = calculateFixScoreValue(deltaS, reviewCount, confidence);
      
      expect(result).toBeCloseTo(expected, 10);
    });
    
    it('should return 0 when deltaS is 0', () => {
      const result = calculateFixScoreValue(0, 100, 1);
      expect(result).toBe(0);
    });
    
    it('should return 0 when confidence is 0', () => {
      const result = calculateFixScoreValue(1, 100, 0);
      expect(result).toBe(0);
    });
    
    it('should return 0 when review count is 0', () => {
      // log(1 + 0) = log(1) = 0
      const result = calculateFixScoreValue(1, 0, 1);
      expect(result).toBe(0);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = calculateFixScoreValue(0.5, 50, 0.9);
      const result2 = calculateFixScoreValue(0.5, 50, 0.9);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('Sign Preservation', () => {
    it('should be positive for positive deltaS', () => {
      const result = calculateFixScoreValue(0.5, 10, 0.8);
      expect(result).toBeGreaterThan(0);
    });
    
    it('should be negative for negative deltaS', () => {
      const result = calculateFixScoreValue(-0.5, 10, 0.8);
      expect(result).toBeLessThan(0);
    });
  });
  
  describe('Scale Factors', () => {
    it('should increase with more reviews (logarithmically)', () => {
      const deltaS = 0.5;
      const confidence = 0.8;
      
      const fewReviews = calculateFixScoreValue(deltaS, 10, confidence);
      const manyReviews = calculateFixScoreValue(deltaS, 100, confidence);
      
      expect(manyReviews).toBeGreaterThan(fewReviews);
      
      // Growth should be logarithmic (sublinear)
      const ratio = manyReviews / fewReviews;
      expect(ratio).toBeLessThan(10); // 10x reviews should not give 10x score
    });
    
    it('should scale linearly with deltaS', () => {
      const reviewCount = 50;
      const confidence = 0.8;
      
      const smallDelta = calculateFixScoreValue(0.2, reviewCount, confidence);
      const largeDelta = calculateFixScoreValue(0.4, reviewCount, confidence);
      
      expect(largeDelta / smallDelta).toBeCloseTo(2, 10);
    });
    
    it('should scale linearly with confidence', () => {
      const deltaS = 0.5;
      const reviewCount = 50;
      
      const lowConf = calculateFixScoreValue(deltaS, reviewCount, 0.4);
      const highConf = calculateFixScoreValue(deltaS, reviewCount, 0.8);
      
      expect(highConf / lowConf).toBeCloseTo(2, 10);
    });
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge Cases', () => {
  describe('Extreme Values', () => {
    it('should handle maximum deltaS', () => {
      const result = calculateFixScoreValue(2, 100, 1);
      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });
    
    it('should handle minimum deltaS', () => {
      const result = calculateFixScoreValue(-2, 100, 1);
      expect(result).toBeLessThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });
    
    it('should handle very large review counts', () => {
      const result = calculateFixScoreValue(0.5, 1000000, 1);
      expect(Number.isFinite(result)).toBe(true);
    });
  });
  
  describe('Zero Cases', () => {
    it('should handle all zeros', () => {
      const result = calculateFixScoreValue(0, 0, 0);
      expect(result).toBe(0);
    });
    
    it('should handle zero baseline and current', () => {
      const deltaS = calculateDeltaS(0, 0);
      expect(deltaS).toBe(0);
    });
  });
  
  describe('Floating Point Precision', () => {
    it('should handle small values without precision loss', () => {
      const result = calculateDeltaS(0.123456789, 0.123456790);
      expect(result).toBeCloseTo(0.000000001, 10);
    });
    
    it('should handle values near bounds', () => {
      const result1 = calculateDeltaS(-0.999999, 0.999999);
      expect(result1).toBeCloseTo(1.999998, 5);
      
      const result2 = calculateDeltaS(0.999999, -0.999999);
      expect(result2).toBeCloseTo(-1.999998, 5);
    });
  });
});

// ============================================================
// INSUFFICIENT DATA SCENARIOS
// ============================================================

describe('Insufficient Data Scenarios', () => {
  describe('Confidence Impact', () => {
    it('should reduce FixScore when confidence is low', () => {
      const deltaS = 0.5;
      const reviewCount = 50;
      
      const highConf = calculateFixScoreValue(deltaS, reviewCount, 1.0);
      const medConf = calculateFixScoreValue(deltaS, reviewCount, 0.7);
      const lowConf = calculateFixScoreValue(deltaS, reviewCount, 0.3);
      const insuffConf = calculateFixScoreValue(deltaS, reviewCount, 0);
      
      expect(highConf).toBeGreaterThan(medConf);
      expect(medConf).toBeGreaterThan(lowConf);
      expect(lowConf).toBeGreaterThan(insuffConf);
      expect(insuffConf).toBe(0);
    });
    
    it('should zero out FixScore for insufficient data', () => {
      // When confidence is 0 (insufficient data), FixScore should be 0
      const result = calculateFixScoreValue(1.5, 100, 0);
      expect(result).toBe(0);
    });
  });
  
  describe('Review Count Impact', () => {
    it('should have minimal impact with very few reviews', () => {
      const deltaS = 0.5;
      const confidence = 1.0;
      
      // log(1 + 1) = log(2) ≈ 0.693
      const oneReview = calculateFixScoreValue(deltaS, 1, confidence);
      
      // log(1 + 50) ≈ 3.93
      const manyReviews = calculateFixScoreValue(deltaS, 50, confidence);
      
      // Few reviews should produce much smaller score
      expect(oneReview).toBeLessThan(manyReviews * 0.3);
    });
  });
});

// ============================================================
// DETERMINISM COMPREHENSIVE TESTS
// ============================================================

describe('Determinism Comprehensive', () => {
  it('should produce same FixScore for repeated calculations', () => {
    const testScenarios = [
      { deltaS: 0.5, reviewCount: 25, confidence: 0.9 },
      { deltaS: -0.3, reviewCount: 100, confidence: 0.7 },
      { deltaS: 1.2, reviewCount: 5, confidence: 0.5 },
      { deltaS: -1.8, reviewCount: 1000, confidence: 1.0 },
    ];
    
    for (const scenario of testScenarios) {
      const results: number[] = [];
      
      // Run same calculation 5 times
      for (let i = 0; i < 5; i++) {
        results.push(calculateFixScoreValue(
          scenario.deltaS,
          scenario.reviewCount,
          scenario.confidence
        ));
      }
      
      // All results should be identical
      const first = results[0];
      for (const result of results) {
        expect(result).toBe(first);
      }
    }
  });
  
  it('should produce same deltaS for repeated calculations', () => {
    const pairs = [
      { baseline: -0.5, current: 0.5 },
      { baseline: 0.3, current: 0.8 },
      { baseline: -0.9, current: -0.2 },
    ];
    
    for (const pair of pairs) {
      const results: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        results.push(calculateDeltaS(pair.baseline, pair.current));
      }
      
      const first = results[0];
      for (const result of results) {
        expect(result).toBe(first);
      }
    }
  });
});

// ============================================================
// REAL-WORLD SCENARIOS
// ============================================================

describe('Real-World Scenarios', () => {
  describe('Successful Fix', () => {
    it('should produce high positive score for significant improvement with many reviews', () => {
      // Theme went from -0.6 to +0.4 with 50 reviews and high confidence
      const deltaS = calculateDeltaS(-0.6, 0.4);
      const fixScore = calculateFixScoreValue(deltaS, 50, 0.9);
      
      expect(deltaS).toBe(1.0);
      expect(fixScore).toBeGreaterThan(3); // Significant positive impact
    });
  });
  
  describe('Failed Fix', () => {
    it('should produce negative score for decline', () => {
      // Theme went from +0.3 to -0.2 (got worse)
      const deltaS = calculateDeltaS(0.3, -0.2);
      const fixScore = calculateFixScoreValue(deltaS, 30, 0.8);
      
      expect(deltaS).toBe(-0.5);
      expect(fixScore).toBeLessThan(0);
    });
  });
  
  describe('Marginal Change', () => {
    it('should produce small score for minor improvement', () => {
      // Small improvement: -0.1 to 0.0
      const deltaS = calculateDeltaS(-0.1, 0.0);
      const fixScore = calculateFixScoreValue(deltaS, 20, 0.8);
      
      expect(deltaS).toBe(0.1);
      expect(Math.abs(fixScore)).toBeLessThan(1); // Small impact
    });
  });
  
  describe('Low Confidence Scenario', () => {
    it('should heavily discount good improvement with low confidence', () => {
      // Good improvement but few reviews (low confidence)
      const deltaS = calculateDeltaS(-0.8, 0.5);
      const highConfScore = calculateFixScoreValue(deltaS, 100, 0.9);
      const lowConfScore = calculateFixScoreValue(deltaS, 100, 0.3);
      
      expect(highConfScore / lowConfScore).toBeCloseTo(3, 1); // 3x difference
    });
  });
});
