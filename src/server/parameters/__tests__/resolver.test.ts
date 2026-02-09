/**
 * Parameter Resolver Tests
 * 
 * Tests for:
 * - Precedence (global → tenant → branch → source → theme)
 * - Defaults
 * - Clamping
 * - Missing keys
 */

import { describe, it, expect } from 'vitest';
import {
  ParameterResolver,
  resolveParameters,
  globalOverride,
  tenantOverride,
  branchOverride,
  sourceOverride,
  themeOverride,
} from '../resolver';
import { DEFAULT_PARAMETERS, PARAMETER_BOUNDS } from '../defaults';
import type { ParameterContext, ParameterSet } from '../types';
import { SourceType } from '@prisma/client';

describe('ParameterResolver', () => {
  // ============================================================
  // PRECEDENCE TESTS
  // ============================================================
  
  describe('Precedence', () => {
    it('should use base parameters when no overrides', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        []
      );
      
      const snapshot = resolver.resolve({});
      
      expect(snapshot.parameters.time.review_half_life_days).toBe(60);
      expect(snapshot.parameters.source.weights.google).toBe(1.20);
    });
    
    it('should apply global overrides', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            time: { review_half_life_days: 90 },
          }),
        ]
      );
      
      const snapshot = resolver.resolve({});
      
      expect(snapshot.parameters.time.review_half_life_days).toBe(90);
    });
    
    it('should apply tenant overrides over global', () => {
      const tenantId = 'tenant-123';
      
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            time: { review_half_life_days: 90 },
          }),
          tenantOverride(tenantId, {
            time: { review_half_life_days: 45 },
          }),
        ]
      );
      
      // Without tenant context - should use global
      const snapshot1 = resolver.resolve({});
      expect(snapshot1.parameters.time.review_half_life_days).toBe(90);
      
      // With tenant context - should use tenant override
      const snapshot2 = resolver.resolve({ tenantId });
      expect(snapshot2.parameters.time.review_half_life_days).toBe(45);
    });
    
    it('should apply branch overrides over tenant', () => {
      const tenantId = 'tenant-123';
      const branchId = 'branch-456';
      
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          tenantOverride(tenantId, {
            time: { review_half_life_days: 45 },
          }),
          branchOverride(branchId, {
            time: { review_half_life_days: 30 },
          }),
        ]
      );
      
      // With tenant context only
      const snapshot1 = resolver.resolve({ tenantId });
      expect(snapshot1.parameters.time.review_half_life_days).toBe(45);
      
      // With branch context
      const snapshot2 = resolver.resolve({ tenantId, branchId });
      expect(snapshot2.parameters.time.review_half_life_days).toBe(30);
    });
    
    it('should apply source overrides over branch', () => {
      const tenantId = 'tenant-123';
      const branchId = 'branch-456';
      const sourceType = SourceType.GOOGLE;
      
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          branchOverride(branchId, {
            engagement: { cap: 1.5 },
          }),
          sourceOverride('google', {
            engagement: { cap: 1.8 },
          }),
        ]
      );
      
      // With branch context only
      const snapshot1 = resolver.resolve({ tenantId, branchId });
      expect(snapshot1.parameters.engagement.cap).toBe(1.5);
      
      // With source context
      const snapshot2 = resolver.resolve({ tenantId, branchId, sourceType });
      expect(snapshot2.parameters.engagement.cap).toBe(1.8);
    });
    
    it('should apply theme overrides over source', () => {
      const context: ParameterContext = {
        tenantId: 'tenant-123',
        branchId: 'branch-456',
        sourceType: SourceType.GOOGLE,
        themeId: 'theme-789',
      };
      
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          sourceOverride('google', {
            confidence: { vague_review_weight: 0.5 },
          }),
          themeOverride('theme-789', {
            confidence: { vague_review_weight: 0.3 },
          }),
        ]
      );
      
      // Without theme context
      const snapshot1 = resolver.resolve({ 
        tenantId: context.tenantId, 
        branchId: context.branchId,
        sourceType: context.sourceType,
      });
      expect(snapshot1.parameters.confidence.vague_review_weight).toBe(0.5);
      
      // With theme context
      const snapshot2 = resolver.resolve(context);
      expect(snapshot2.parameters.confidence.vague_review_weight).toBe(0.3);
    });
    
    it('should respect full precedence chain: global → tenant → branch → source → theme', () => {
      const context: ParameterContext = {
        tenantId: 'tenant-123',
        branchId: 'branch-456',
        sourceType: SourceType.HELLOPETER,
        themeId: 'theme-789',
      };
      
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({ time: { review_half_life_days: 100 } }),
          tenantOverride('tenant-123', { time: { review_half_life_days: 80 } }),
          branchOverride('branch-456', { time: { review_half_life_days: 60 } }),
          sourceOverride('hellopeter', { time: { review_half_life_days: 40 } }),
          themeOverride('theme-789', { time: { review_half_life_days: 20 } }),
        ]
      );
      
      const snapshot = resolver.resolve(context);
      
      // Theme has highest precedence
      expect(snapshot.parameters.time.review_half_life_days).toBe(20);
    });
    
    it('should only apply matching overrides', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          tenantOverride('tenant-AAA', { time: { review_half_life_days: 100 } }),
          tenantOverride('tenant-BBB', { time: { review_half_life_days: 50 } }),
        ]
      );
      
      // Different tenant - should not apply either override
      const snapshot1 = resolver.resolve({ tenantId: 'tenant-CCC' });
      expect(snapshot1.parameters.time.review_half_life_days).toBe(60); // default
      
      // Matching tenant
      const snapshot2 = resolver.resolve({ tenantId: 'tenant-BBB' });
      expect(snapshot2.parameters.time.review_half_life_days).toBe(50);
    });
  });
  
  // ============================================================
  // DEFAULTS TESTS
  // ============================================================
  
  describe('Defaults', () => {
    it('should use default parameters when nothing is overridden', () => {
      const snapshot = resolveParameters({});
      
      expect(snapshot.parameters).toEqual(
        expect.objectContaining({
          sentiment: expect.objectContaining({
            model_version: 'gpt-4-turbo',
            use_star_rating: true,
          }),
          time: expect.objectContaining({
            review_half_life_days: 60,
          }),
        })
      );
    });
    
    it('should preserve non-overridden values', () => {
      const snapshot = resolveParameters({}, [
        globalOverride({
          time: { review_half_life_days: 90 },
        }),
      ]);
      
      // Overridden
      expect(snapshot.parameters.time.review_half_life_days).toBe(90);
      
      // Not overridden - should use defaults
      expect(snapshot.parameters.source.weights.google).toBe(1.20);
      expect(snapshot.parameters.engagement.cap).toBe(1.30);
    });
    
    it('should deep merge nested objects', () => {
      const snapshot = resolveParameters({}, [
        globalOverride({
          source: {
            weights: {
              google: 1.35, // Override only google
            },
          },
        }),
      ]);
      
      // Overridden
      expect(snapshot.parameters.source.weights.google).toBe(1.35);
      
      // Not overridden in same object - should use defaults
      expect(snapshot.parameters.source.weights.hellopeter).toBe(1.15);
      expect(snapshot.parameters.source.min_weight).toBe(0.60);
    });
  });
  
  // ============================================================
  // CLAMPING TESTS
  // ============================================================
  
  describe('Clamping', () => {
    it('should clamp values below minimum', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            time: { review_half_life_days: 0 }, // Below min of 1
          }),
        ],
        { clampValues: true }
      );
      
      const snapshot = resolver.resolve({});
      
      // Should be clamped to min (1)
      expect(snapshot.parameters.time.review_half_life_days).toBe(1);
    });
    
    it('should clamp values above maximum', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            time: { review_half_life_days: 500 }, // Above max of 365
          }),
        ],
        { clampValues: true }
      );
      
      const snapshot = resolver.resolve({});
      
      // Should be clamped to max (365)
      expect(snapshot.parameters.time.review_half_life_days).toBe(365);
    });
    
    it('should clamp source weights to min/max', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            source: {
              weights: {
                google: 2.0, // Above max of 1.4
                twitter: 0.1, // Below min of 0.6
              },
            },
          }),
        ],
        { clampValues: true }
      );
      
      const snapshot = resolver.resolve({});
      
      // Should be clamped to bounds
      expect(snapshot.parameters.source.weights.google).toBe(1.4);
      expect(snapshot.parameters.source.weights.twitter).toBe(0.6);
    });
    
    it('should use dynamic min/max from parameters for source weights', () => {
      const resolver = new ParameterResolver(
        {
          ...DEFAULT_PARAMETERS,
          source: {
            ...DEFAULT_PARAMETERS.source,
            min_weight: 0.5,
            max_weight: 1.5,
            weights: {
              ...DEFAULT_PARAMETERS.source.weights,
              google: 2.0, // Will be clamped to 1.5
            },
          },
        },
        'test-version',
        [],
        { clampValues: true }
      );
      
      const snapshot = resolver.resolve({});
      
      // Should be clamped to the custom max_weight
      expect(snapshot.parameters.source.weights.google).toBe(1.5);
    });
    
    it('should not clamp when disabled', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            time: { review_half_life_days: 500 },
          }),
        ],
        { clampValues: false }
      );
      
      const snapshot = resolver.resolve({});
      
      // Should not be clamped
      expect(snapshot.parameters.time.review_half_life_days).toBe(500);
    });
    
    it('should clamp confidence weights to [0, 1]', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride({
            confidence: {
              vague_review_weight: 1.5, // Above max of 1.0
              duplicate_review_weight: -0.5, // Below min of 0
            },
          }),
        ],
        { clampValues: true }
      );
      
      const snapshot = resolver.resolve({});
      
      expect(snapshot.parameters.confidence.vague_review_weight).toBe(1.0);
      expect(snapshot.parameters.confidence.duplicate_review_weight).toBe(0);
    });
  });
  
  // ============================================================
  // MISSING KEYS TESTS
  // ============================================================
  
  describe('Missing Keys', () => {
    it('should provide all required keys from defaults', () => {
      const snapshot = resolveParameters({});
      
      // Check all required sections exist
      expect(snapshot.parameters.sentiment).toBeDefined();
      expect(snapshot.parameters.time).toBeDefined();
      expect(snapshot.parameters.source).toBeDefined();
      expect(snapshot.parameters.engagement).toBeDefined();
      expect(snapshot.parameters.confidence).toBeDefined();
      expect(snapshot.parameters.fix_tracking).toBeDefined();
    });
    
    it('should have all required nested keys', () => {
      const snapshot = resolveParameters({});
      
      // Sentiment
      expect(snapshot.parameters.sentiment.model_version).toBeDefined();
      expect(snapshot.parameters.sentiment.use_star_rating).toBeDefined();
      expect(snapshot.parameters.sentiment.language_handling_mode).toBeDefined();
      
      // Time
      expect(snapshot.parameters.time.review_half_life_days).toBeDefined();
      
      // Source
      expect(snapshot.parameters.source.weights).toBeDefined();
      expect(snapshot.parameters.source.min_weight).toBeDefined();
      expect(snapshot.parameters.source.max_weight).toBeDefined();
      
      // Engagement
      expect(snapshot.parameters.engagement.enabled_by_source).toBeDefined();
      expect(snapshot.parameters.engagement.cap).toBeDefined();
      
      // Confidence
      expect(snapshot.parameters.confidence.rules_version).toBeDefined();
      expect(snapshot.parameters.confidence.min_text_length_chars).toBeDefined();
      expect(snapshot.parameters.confidence.duplicate_similarity_threshold).toBeDefined();
      
      // Fix tracking
      expect(snapshot.parameters.fix_tracking.pre_window_days).toBeDefined();
      expect(snapshot.parameters.fix_tracking.post_window_days).toBeDefined();
      expect(snapshot.parameters.fix_tracking.min_reviews_for_inference).toBeDefined();
      expect(snapshot.parameters.fix_tracking.confidence_thresholds).toBeDefined();
    });
    
    it('should not lose keys when applying partial overrides', () => {
      const snapshot = resolveParameters({}, [
        globalOverride({
          confidence: {
            min_text_length_chars: 50, // Only override one key
          },
        }),
      ]);
      
      // Overridden key
      expect(snapshot.parameters.confidence.min_text_length_chars).toBe(50);
      
      // Other keys should still exist
      expect(snapshot.parameters.confidence.rules_version).toBe('1.0.0');
      expect(snapshot.parameters.confidence.duplicate_similarity_threshold).toBe(0.85);
      expect(snapshot.parameters.confidence.vague_review_weight).toBe(0.70);
    });
  });
  
  // ============================================================
  // SNAPSHOT METADATA TESTS
  // ============================================================
  
  describe('Snapshot Metadata', () => {
    it('should include snapshot ID', () => {
      const snapshot = resolveParameters({});
      
      expect(snapshot.snapshotId).toBeDefined();
      expect(typeof snapshot.snapshotId).toBe('string');
      expect(snapshot.snapshotId.length).toBeGreaterThan(0);
    });
    
    it('should record base version ID', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'version-123',
        []
      );
      
      const snapshot = resolver.resolve({});
      
      expect(snapshot.baseVersionId).toBe('version-123');
    });
    
    it('should record applied override IDs', () => {
      const snapshot = resolveParameters({ tenantId: 'tenant-123' }, [
        globalOverride({ time: { review_half_life_days: 90 } }),
        tenantOverride('tenant-123', { time: { review_half_life_days: 45 } }),
      ]);
      
      expect(snapshot.appliedOverrideIds).toContain('global');
      expect(snapshot.appliedOverrideIds).toContain('tenant-123');
    });
    
    it('should include context in snapshot', () => {
      const context: ParameterContext = {
        tenantId: 'tenant-123',
        branchId: 'branch-456',
        sourceType: SourceType.GOOGLE,
        themeId: 'theme-789',
      };
      
      const snapshot = resolveParameters(context);
      
      expect(snapshot.context).toEqual(context);
    });
    
    it('should include creation timestamp', () => {
      const before = new Date();
      const snapshot = resolveParameters({});
      const after = new Date();
      
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
  
  // ============================================================
  // INACTIVE OVERRIDE TESTS
  // ============================================================
  
  describe('Inactive Overrides', () => {
    it('should not apply inactive overrides', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride(
            { time: { review_half_life_days: 90 } },
            { isActive: false }
          ),
        ]
      );
      
      const snapshot = resolver.resolve({});
      
      // Should use default, not override
      expect(snapshot.parameters.time.review_half_life_days).toBe(60);
    });
    
    it('should apply active overrides and skip inactive', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride(
            { time: { review_half_life_days: 90 } },
            { isActive: true }
          ),
          tenantOverride(
            'tenant-123',
            { time: { review_half_life_days: 30 } },
            { isActive: false }
          ),
        ]
      );
      
      const snapshot = resolver.resolve({ tenantId: 'tenant-123' });
      
      // Should use global (active), not tenant (inactive)
      expect(snapshot.parameters.time.review_half_life_days).toBe(90);
    });
  });
  
  // ============================================================
  // PRIORITY TESTS
  // ============================================================
  
  describe('Priority within scope', () => {
    it('should apply higher priority override within same scope', () => {
      const resolver = new ParameterResolver(
        DEFAULT_PARAMETERS,
        'test-version',
        [
          globalOverride(
            { time: { review_half_life_days: 30 } },
            { priority: 1 }
          ),
          globalOverride(
            { time: { review_half_life_days: 90 } },
            { priority: 2 }
          ),
        ]
      );
      
      const snapshot = resolver.resolve({});
      
      // Higher priority (2) should win
      expect(snapshot.parameters.time.review_half_life_days).toBe(90);
    });
  });
});
