/**
 * Parameter Validation Tests
 * 
 * Tests for validation, clamping, and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  validateParameterSet,
  validatePartialParameterSet,
  clampValue,
  clampParameterSet,
  clampSourceWeights,
  getValueByPath,
  setValueByPath,
  flattenObject,
  hasRequiredKeys,
  fillDefaults,
  deepMerge,
} from '../validation';
import { DEFAULT_PARAMETERS, PARAMETER_BOUNDS } from '../defaults';
import type { ParameterSet, PartialParameterSet } from '../types';

describe('Validation', () => {
  // ============================================================
  // VALIDATE COMPLETE PARAMETER SET
  // ============================================================
  
  describe('validateParameterSet', () => {
    it('should pass for valid default parameters', () => {
      const result = validateParameterSet(DEFAULT_PARAMETERS);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail for null input', () => {
      const result = validateParameterSet(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should fail for missing required sections', () => {
      const incomplete = {
        sentiment: DEFAULT_PARAMETERS.sentiment,
        // Missing: time, source, engagement, confidence, fix_tracking
      };
      
      const result = validateParameterSet(incomplete);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'time')).toBe(true);
      expect(result.errors.some(e => e.path === 'source')).toBe(true);
    });
    
    it('should fail for missing required keys within sections', () => {
      const params = {
        ...DEFAULT_PARAMETERS,
        sentiment: {
          // Missing: model_version, use_star_rating, language_handling_mode
        },
      };
      
      const result = validateParameterSet(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'sentiment.model_version')).toBe(true);
    });
    
    it('should fail for invalid enum values', () => {
      const params = {
        ...DEFAULT_PARAMETERS,
        sentiment: {
          ...DEFAULT_PARAMETERS.sentiment,
          language_handling_mode: 'invalid_mode',
        },
      };
      
      const result = validateParameterSet(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.path === 'sentiment.language_handling_mode' &&
        e.message.includes('Must be one of')
      )).toBe(true);
    });
    
    it('should warn for values outside bounds', () => {
      const params = {
        ...DEFAULT_PARAMETERS,
        time: {
          review_half_life_days: 500, // Above max of 365
        },
      };
      
      const result = validateParameterSet(params);
      
      // Should have warnings but still be valid (warnings don't fail validation)
      expect(result.warnings.some(w => 
        w.path === 'time.review_half_life_days' &&
        w.message.includes('above maximum')
      )).toBe(true);
    });
    
    it('should fail for invalid confidence threshold ordering', () => {
      const params = {
        ...DEFAULT_PARAMETERS,
        fix_tracking: {
          ...DEFAULT_PARAMETERS.fix_tracking,
          confidence_thresholds: {
            high: 5,
            medium: 10, // Should be less than high
            low: 2,
          },
        },
      };
      
      const result = validateParameterSet(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.path === 'fix_tracking.confidence_thresholds' &&
        e.message.includes('medium')
      )).toBe(true);
    });
    
    it('should fail for invalid min/max weight ordering', () => {
      const params = {
        ...DEFAULT_PARAMETERS,
        source: {
          ...DEFAULT_PARAMETERS.source,
          min_weight: 1.5,
          max_weight: 1.0, // Should be greater than min
        },
      };
      
      const result = validateParameterSet(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.path === 'source' &&
        e.message.includes('min_weight')
      )).toBe(true);
    });
  });
  
  // ============================================================
  // VALIDATE PARTIAL PARAMETER SET
  // ============================================================
  
  describe('validatePartialParameterSet', () => {
    it('should pass for valid partial parameters', () => {
      const partial: PartialParameterSet = {
        time: { review_half_life_days: 90 },
      };
      
      const result = validatePartialParameterSet(partial);
      
      expect(result.valid).toBe(true);
    });
    
    it('should warn for unknown parameter paths', () => {
      const partial = {
        unknown_section: { unknown_key: 'value' },
      } as PartialParameterSet;
      
      const result = validatePartialParameterSet(partial);
      
      expect(result.warnings.some(w => 
        w.message.includes('Unknown parameter path')
      )).toBe(true);
    });
    
    it('should fail for invalid enum values in partial', () => {
      const partial: PartialParameterSet = {
        sentiment: {
          language_handling_mode: 'invalid' as any,
        },
      };
      
      const result = validatePartialParameterSet(partial);
      
      expect(result.valid).toBe(false);
    });
    
    it('should warn for values outside bounds in partial', () => {
      const partial: PartialParameterSet = {
        confidence: {
          vague_review_weight: 1.5, // Above max of 1.0
        },
      };
      
      const result = validatePartialParameterSet(partial);
      
      expect(result.warnings.some(w => 
        w.path === 'confidence.vague_review_weight'
      )).toBe(true);
    });
  });
  
  // ============================================================
  // CLAMPING
  // ============================================================
  
  describe('clampValue', () => {
    it('should clamp value below minimum', () => {
      const result = clampValue('time.review_half_life_days', 0);
      expect(result).toBe(1); // min is 1
    });
    
    it('should clamp value above maximum', () => {
      const result = clampValue('time.review_half_life_days', 500);
      expect(result).toBe(365); // max is 365
    });
    
    it('should not clamp value within bounds', () => {
      const result = clampValue('time.review_half_life_days', 60);
      expect(result).toBe(60);
    });
    
    it('should return original value for unknown path', () => {
      const result = clampValue('unknown.path', 999);
      expect(result).toBe(999);
    });
  });
  
  describe('clampParameterSet', () => {
    it('should clamp all out-of-bounds values', () => {
      const params: ParameterSet = {
        ...DEFAULT_PARAMETERS,
        time: { review_half_life_days: 500 },
        confidence: {
          ...DEFAULT_PARAMETERS.confidence,
          vague_review_weight: 2.0,
          duplicate_review_weight: -0.5,
        },
      };
      
      const clamped = clampParameterSet(params);
      
      expect(clamped.time.review_half_life_days).toBe(365);
      expect(clamped.confidence.vague_review_weight).toBe(1.0);
      expect(clamped.confidence.duplicate_review_weight).toBe(0);
    });
    
    it('should not modify original object', () => {
      const params = { ...DEFAULT_PARAMETERS };
      params.time = { review_half_life_days: 500 };
      
      clampParameterSet(params);
      
      expect(params.time.review_half_life_days).toBe(500);
    });
  });
  
  describe('clampSourceWeights', () => {
    it('should clamp source weights to min/max', () => {
      const params: ParameterSet = {
        ...DEFAULT_PARAMETERS,
        source: {
          ...DEFAULT_PARAMETERS.source,
          weights: {
            google: 2.0, // Above max
            twitter: 0.1, // Below min
            facebook: 0.9, // Within bounds
          },
        },
      };
      
      const clamped = clampSourceWeights(params);
      
      expect(clamped.source.weights.google).toBe(1.40);
      expect(clamped.source.weights.twitter).toBe(0.60);
      expect(clamped.source.weights.facebook).toBe(0.9);
    });
    
    it('should use custom min/max from parameters', () => {
      const params: ParameterSet = {
        ...DEFAULT_PARAMETERS,
        source: {
          min_weight: 0.5,
          max_weight: 1.5,
          weights: {
            google: 2.0,
            twitter: 0.3,
          },
        },
      };
      
      const clamped = clampSourceWeights(params);
      
      expect(clamped.source.weights.google).toBe(1.5);
      expect(clamped.source.weights.twitter).toBe(0.5);
    });
  });
  
  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  
  describe('getValueByPath', () => {
    it('should get nested value by path', () => {
      const obj = { a: { b: { c: 123 } } };
      expect(getValueByPath(obj, 'a.b.c')).toBe(123);
    });
    
    it('should return undefined for non-existent path', () => {
      const obj = { a: { b: 1 } };
      expect(getValueByPath(obj, 'a.c.d')).toBeUndefined();
    });
    
    it('should handle null values', () => {
      const obj = { a: null };
      expect(getValueByPath(obj, 'a.b')).toBeUndefined();
    });
  });
  
  describe('setValueByPath', () => {
    it('should set nested value by path', () => {
      const obj = { a: { b: { c: 1 } } };
      setValueByPath(obj, 'a.b.c', 999);
      expect(obj.a.b.c).toBe(999);
    });
    
    it('should create intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      setValueByPath(obj, 'a.b.c', 123);
      expect((obj.a as any).b.c).toBe(123);
    });
  });
  
  describe('flattenObject', () => {
    it('should flatten nested object to dot notation', () => {
      const obj = {
        a: { b: 1, c: 2 },
        d: 3,
      };
      
      const flat = flattenObject(obj);
      
      expect(flat).toEqual({
        'a.b': 1,
        'a.c': 2,
        'd': 3,
      });
    });
    
    it('should handle arrays as values', () => {
      const obj = {
        a: [1, 2, 3],
      };
      
      const flat = flattenObject(obj);
      
      expect(flat).toEqual({
        'a': [1, 2, 3],
      });
    });
  });
  
  describe('hasRequiredKeys', () => {
    it('should return true for valid parameters', () => {
      expect(hasRequiredKeys(DEFAULT_PARAMETERS)).toBe(true);
    });
    
    it('should return false for incomplete parameters', () => {
      expect(hasRequiredKeys({ sentiment: {} })).toBe(false);
    });
  });
  
  describe('fillDefaults', () => {
    it('should fill missing values with defaults', () => {
      const partial: PartialParameterSet = {
        time: { review_half_life_days: 90 },
      };
      
      const filled = fillDefaults(partial);
      
      expect(filled.time.review_half_life_days).toBe(90);
      expect(filled.sentiment).toEqual(DEFAULT_PARAMETERS.sentiment);
      expect(filled.source).toEqual(DEFAULT_PARAMETERS.source);
    });
  });
  
  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const base = { a: { b: 1, c: 2 }, d: 3 };
      const overrides = { a: { b: 10 } };
      
      const merged = deepMerge(base, overrides);
      
      expect(merged).toEqual({
        a: { b: 10, c: 2 },
        d: 3,
      });
    });
    
    it('should not modify original objects', () => {
      const base = { a: { b: 1 } };
      const overrides = { a: { b: 10 } };
      
      deepMerge(base, overrides);
      
      expect(base.a.b).toBe(1);
    });
    
    it('should replace arrays, not merge them', () => {
      const base = { arr: [1, 2, 3] };
      const overrides = { arr: [4, 5] };
      
      const merged = deepMerge(base, overrides);
      
      expect(merged.arr).toEqual([4, 5]);
    });
    
    it('should skip undefined values', () => {
      const base = { a: 1, b: 2 };
      const overrides = { a: undefined, b: 10 };
      
      const merged = deepMerge(base, overrides as Record<string, unknown>);
      
      expect(merged.a).toBe(1);
      expect(merged.b).toBe(10);
    });
  });
});

describe('Parameter Bounds', () => {
  it('should have bounds defined for critical parameters', () => {
    const criticalPaths = [
      'time.review_half_life_days',
      'source.min_weight',
      'source.max_weight',
      'engagement.cap',
      'confidence.min_text_length_chars',
      'confidence.duplicate_similarity_threshold',
    ];
    
    for (const path of criticalPaths) {
      expect(PARAMETER_BOUNDS[path]).toBeDefined();
    }
  });
  
  it('should have sensible bounds for all defined parameters', () => {
    for (const [path, bounds] of Object.entries(PARAMETER_BOUNDS)) {
      if (bounds.min !== undefined && bounds.max !== undefined) {
        expect(bounds.min).toBeLessThan(bounds.max);
      }
    }
  });
});
