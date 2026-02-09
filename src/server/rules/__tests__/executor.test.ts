/**
 * Rule Executor Tests
 * 
 * Tests for:
 * - Confidence rule execution
 * - Sufficiency rule execution
 * - Condition evaluation (comparison operators)
 * - Compound conditions (AND, OR, NOT)
 * - Priority ordering
 * - Explain payload generation
 */

import { describe, it, expect } from 'vitest';
import {
  RuleExecutor,
  executeConfidenceRules,
  executeSufficiencyRules,
  createRuleExecutor,
} from '../executor';
import {
  RuleCategory,
  ConfidenceReasonCode,
  SufficiencyReasonCode,
  SufficiencyLevel,
} from '../types';
import type {
  RuleSet,
  ConfidenceRule,
  SufficiencyRule,
  ReviewContext,
  FixScoreContext,
} from '../types';
import { getDefaultRuleSet } from '../defaults';

// ============================================================
// TEST FIXTURES
// ============================================================

const createTestRuleSet = (overrides: Partial<RuleSet> = {}): RuleSet => ({
  version: '1.0.0-test',
  confidenceRules: [],
  sufficiencyRules: [],
  defaultConfidenceWeight: 1.0,
  defaultSufficiency: {
    level: SufficiencyLevel.MEDIUM,
    confidence: 0.7,
  },
  ...overrides,
});

const createTestReview = (overrides: Partial<ReviewContext> = {}): ReviewContext => ({
  id: 'review-123',
  content: 'This is a test review with enough content to be meaningful.',
  contentLength: 58,
  rating: 4,
  sourceType: 'google',
  authorName: 'Test Author',
  detectedLanguage: 'en',
  duplicateSimilarity: null,
  likesCount: 0,
  repliesCount: 0,
  ...overrides,
});

const createTestFixScoreContext = (overrides: Partial<FixScoreContext> = {}): FixScoreContext => ({
  themeId: 'theme-123',
  taskId: 'task-456',
  reviewCountPre: 10,
  reviewCountPost: 8,
  totalReviews: 18,
  scoreBefore: 0.3,
  scoreAfter: 0.6,
  deltaS: 0.3,
  variancePre: 0.2,
  variancePost: 0.15,
  preWindowDays: 30,
  postWindowDays: 30,
  ...overrides,
});

// ============================================================
// CONFIDENCE RULE TESTS
// ============================================================

describe('Confidence Rules', () => {
  describe('Basic Execution', () => {
    it('should return default weight when no rules match', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [],
        defaultConfidenceWeight: 1.0,
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview());
      
      expect(result.score).toBe(1.0);
      expect(result.explain.usedDefault).toBe(true);
      expect(result.explain.appliedRule).toBeNull();
      expect(result.explain.reasonCode).toBe(ConfidenceReasonCode.FULL_CONFIDENCE);
    });
    
    it('should apply matching rule weight', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: { field: 'contentLength', operator: 'gt', value: 10 },
            action: {
              weight: 0.8,
              reasonCode: ConfidenceReasonCode.CUSTOM,
              reasonMessage: 'Test reason',
            },
          },
        ],
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview({ contentLength: 50 }));
      
      expect(result.score).toBe(0.8);
      expect(result.explain.usedDefault).toBe(false);
      expect(result.explain.appliedRule?.ruleId).toBe('test-rule');
    });
    
    it('should skip disabled rules', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'disabled-rule',
            name: 'Disabled Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: false,
            priority: 100,
            conditions: { field: 'contentLength', operator: 'gt', value: 0 },
            action: {
              weight: 0.1,
              reasonCode: ConfidenceReasonCode.SPAM_INDICATORS,
            },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview());
      
      expect(result.score).toBe(1.0);
      expect(result.explain.usedDefault).toBe(true);
    });
  });
  
  describe('Priority Ordering', () => {
    it('should apply highest priority matching rule first', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'low-priority',
            name: 'Low Priority',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: { field: 'contentLength', operator: 'gt', value: 0 },
            action: {
              weight: 0.9,
              reasonCode: ConfidenceReasonCode.CUSTOM,
            },
          },
          {
            id: 'high-priority',
            name: 'High Priority',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 100,
            conditions: { field: 'contentLength', operator: 'gt', value: 0 },
            action: {
              weight: 0.5,
              reasonCode: ConfidenceReasonCode.SPAM_INDICATORS,
            },
          },
        ],
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview());
      
      expect(result.score).toBe(0.5);
      expect(result.explain.appliedRule?.ruleId).toBe('high-priority');
    });
    
    it('should collect all matching rules in explain payload', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'rule-1',
            name: 'Rule 1',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: { field: 'contentLength', operator: 'gt', value: 0 },
            action: { weight: 0.9, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
          {
            id: 'rule-2',
            name: 'Rule 2',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 20,
            conditions: { field: 'contentLength', operator: 'gt', value: 0 },
            action: { weight: 0.8, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview());
      
      // Both rules matched, but higher priority applied
      expect(result.explain.matches).toHaveLength(2);
      expect(result.explain.appliedRule?.ruleId).toBe('rule-2');
    });
  });
  
  describe('Comparison Operators', () => {
    const testOperator = (
      operator: string,
      field: string,
      value: unknown,
      reviewValue: unknown,
      shouldMatch: boolean
    ) => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'operator-test',
            name: 'Operator Test',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: { field, operator: operator as any, value },
            action: { weight: 0.5, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      const review = createTestReview({ [field]: reviewValue });
      const result = executeConfidenceRules(ruleSet, review);
      
      expect(result.explain.usedDefault).toBe(!shouldMatch);
    };
    
    it('eq: matches equal values', () => {
      testOperator('eq', 'rating', 4, 4, true);
      testOperator('eq', 'rating', 4, 5, false);
    });
    
    it('neq: matches non-equal values', () => {
      testOperator('neq', 'rating', 4, 5, true);
      testOperator('neq', 'rating', 4, 4, false);
    });
    
    it('gt: matches greater values', () => {
      testOperator('gt', 'contentLength', 10, 20, true);
      testOperator('gt', 'contentLength', 10, 10, false);
      testOperator('gt', 'contentLength', 10, 5, false);
    });
    
    it('gte: matches greater or equal values', () => {
      testOperator('gte', 'contentLength', 10, 20, true);
      testOperator('gte', 'contentLength', 10, 10, true);
      testOperator('gte', 'contentLength', 10, 5, false);
    });
    
    it('lt: matches lesser values', () => {
      testOperator('lt', 'contentLength', 10, 5, true);
      testOperator('lt', 'contentLength', 10, 10, false);
      testOperator('lt', 'contentLength', 10, 20, false);
    });
    
    it('lte: matches lesser or equal values', () => {
      testOperator('lte', 'contentLength', 10, 5, true);
      testOperator('lte', 'contentLength', 10, 10, true);
      testOperator('lte', 'contentLength', 10, 20, false);
    });
    
    it('in: matches values in array', () => {
      testOperator('in', 'rating', [1, 2, 3], 2, true);
      testOperator('in', 'rating', [1, 2, 3], 5, false);
    });
    
    it('nin: matches values not in array', () => {
      testOperator('nin', 'rating', [1, 2, 3], 5, true);
      testOperator('nin', 'rating', [1, 2, 3], 2, false);
    });
    
    it('contains: matches substring', () => {
      testOperator('contains', 'content', 'test', 'This is a test review', true);
      testOperator('contains', 'content', 'xyz', 'This is a test review', false);
    });
    
    it('startsWith: matches prefix', () => {
      testOperator('startsWith', 'content', 'this', 'This is a test', true);
      testOperator('startsWith', 'content', 'test', 'This is a test', false);
    });
    
    it('endsWith: matches suffix', () => {
      testOperator('endsWith', 'content', 'test', 'This is a test', true);
      testOperator('endsWith', 'content', 'this', 'This is a test', false);
    });
    
    it('matches: matches regex pattern', () => {
      testOperator('matches', 'content', '^good', 'Good review', true);
      testOperator('matches', 'content', '^bad', 'Good review', false);
    });
  });
  
  describe('Compound Conditions', () => {
    it('AND: matches when all conditions are true', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'and-rule',
            name: 'AND Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: {
              logic: 'and',
              conditions: [
                { field: 'contentLength', operator: 'gt', value: 10 },
                { field: 'rating', operator: 'gte', value: 4 },
              ],
            },
            action: { weight: 0.8, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      // Both conditions true
      const result1 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 5 
      }));
      expect(result1.explain.usedDefault).toBe(false);
      
      // One condition false
      const result2 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 2 
      }));
      expect(result2.explain.usedDefault).toBe(true);
    });
    
    it('OR: matches when any condition is true', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'or-rule',
            name: 'OR Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: {
              logic: 'or',
              conditions: [
                { field: 'contentLength', operator: 'lt', value: 10 },
                { field: 'rating', operator: 'eq', value: 1 },
              ],
            },
            action: { weight: 0.5, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      // First condition true
      const result1 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 5, 
        rating: 5 
      }));
      expect(result1.explain.usedDefault).toBe(false);
      
      // Second condition true
      const result2 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 1 
      }));
      expect(result2.explain.usedDefault).toBe(false);
      
      // Neither condition true
      const result3 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 5 
      }));
      expect(result3.explain.usedDefault).toBe(true);
    });
    
    it('NOT: inverts condition result', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'not-rule',
            name: 'NOT Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: {
              logic: 'not',
              conditions: [
                { field: 'rating', operator: 'eq', value: 5 },
              ],
            },
            action: { weight: 0.6, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      // Condition is true, NOT makes it false - rule doesn't match
      const result1 = executeConfidenceRules(ruleSet, createTestReview({ rating: 5 }));
      expect(result1.explain.usedDefault).toBe(true);
      
      // Condition is false, NOT makes it true - rule matches
      const result2 = executeConfidenceRules(ruleSet, createTestReview({ rating: 3 }));
      expect(result2.explain.usedDefault).toBe(false);
    });
    
    it('nested compound conditions', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'nested-rule',
            name: 'Nested Rule',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: {
              logic: 'and',
              conditions: [
                { field: 'contentLength', operator: 'gt', value: 10 },
                {
                  logic: 'or',
                  conditions: [
                    { field: 'rating', operator: 'eq', value: 1 },
                    { field: 'rating', operator: 'eq', value: 5 },
                  ],
                },
              ],
            },
            action: { weight: 0.7, reasonCode: ConfidenceReasonCode.MIXED_SIGNALS },
          },
        ],
        defaultConfidenceWeight: 1.0,
      });
      
      // contentLength > 10 AND (rating = 1 OR rating = 5)
      const result1 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 5 
      }));
      expect(result1.explain.usedDefault).toBe(false);
      
      // contentLength > 10 but rating not 1 or 5
      const result2 = executeConfidenceRules(ruleSet, createTestReview({ 
        contentLength: 50, 
        rating: 3 
      }));
      expect(result2.explain.usedDefault).toBe(true);
    });
  });
  
  describe('Explain Payload', () => {
    it('should include matched conditions details', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'explain-test',
            name: 'Explain Test',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: {
              logic: 'and',
              conditions: [
                { field: 'contentLength', operator: 'lt', value: 100 },
                { field: 'rating', operator: 'gte', value: 3 },
              ],
            },
            action: { 
              weight: 0.8, 
              reasonCode: ConfidenceReasonCode.CUSTOM,
              reasonMessage: 'Custom explanation',
            },
          },
        ],
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview({
        contentLength: 50,
        rating: 4,
      }));
      
      expect(result.explain.appliedRule).not.toBeNull();
      expect(result.explain.appliedRule?.matchedConditions).toHaveLength(2);
      expect(result.explain.appliedRule?.matchedConditions[0]).toEqual({
        field: 'contentLength',
        operator: 'lt',
        expected: 100,
        actual: 50,
      });
      expect(result.explain.appliedRule?.reason).toBe('Custom explanation');
    });
    
    it('should track rules evaluated count', () => {
      const ruleSet = createTestRuleSet({
        confidenceRules: [
          {
            id: 'rule-1',
            name: 'Rule 1',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 10,
            conditions: { field: 'rating', operator: 'eq', value: 99 },
            action: { weight: 0.5, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
          {
            id: 'rule-2',
            name: 'Rule 2',
            category: RuleCategory.CONFIDENCE,
            enabled: true,
            priority: 20,
            conditions: { field: 'rating', operator: 'eq', value: 99 },
            action: { weight: 0.6, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
          {
            id: 'rule-3',
            name: 'Rule 3 (disabled)',
            category: RuleCategory.CONFIDENCE,
            enabled: false,
            priority: 30,
            conditions: { field: 'rating', operator: 'eq', value: 99 },
            action: { weight: 0.7, reasonCode: ConfidenceReasonCode.CUSTOM },
          },
        ],
      });
      
      const result = executeConfidenceRules(ruleSet, createTestReview());
      
      // Only enabled rules are evaluated
      expect(result.explain.rulesEvaluated).toBe(2);
    });
  });
});

// ============================================================
// SUFFICIENCY RULE TESTS
// ============================================================

describe('Sufficiency Rules', () => {
  describe('Basic Execution', () => {
    it('should return default when no rules match', () => {
      const ruleSet = createTestRuleSet({
        sufficiencyRules: [],
        defaultSufficiency: {
          level: SufficiencyLevel.MEDIUM,
          confidence: 0.7,
        },
      });
      
      const result = executeSufficiencyRules(ruleSet, createTestFixScoreContext());
      
      expect(result.score).toBe(0.7);
      expect(result.level).toBe(SufficiencyLevel.MEDIUM);
      expect(result.explain.usedDefault).toBe(true);
    });
    
    it('should apply matching rule', () => {
      const ruleSet = createTestRuleSet({
        sufficiencyRules: [
          {
            id: 'suff-test',
            name: 'Test Sufficiency',
            category: RuleCategory.SUFFICIENCY,
            enabled: true,
            priority: 10,
            conditions: { field: 'totalReviews', operator: 'gte', value: 15 },
            action: {
              level: SufficiencyLevel.HIGH,
              confidence: 1.0,
              reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
            },
          },
        ],
      });
      
      const result = executeSufficiencyRules(ruleSet, createTestFixScoreContext({
        totalReviews: 20,
      }));
      
      expect(result.score).toBe(1.0);
      expect(result.level).toBe(SufficiencyLevel.HIGH);
      expect(result.explain.usedDefault).toBe(false);
    });
  });
  
  describe('Insufficient Data Detection', () => {
    it('should detect no baseline data', () => {
      const ruleSet = createTestRuleSet({
        sufficiencyRules: [
          {
            id: 'no-baseline',
            name: 'No Baseline',
            category: RuleCategory.SUFFICIENCY,
            enabled: true,
            priority: 100,
            conditions: { field: 'reviewCountPre', operator: 'eq', value: 0 },
            action: {
              level: SufficiencyLevel.INSUFFICIENT,
              confidence: 0,
              reasonCode: SufficiencyReasonCode.NO_BASELINE,
            },
          },
        ],
      });
      
      const result = executeSufficiencyRules(ruleSet, createTestFixScoreContext({
        reviewCountPre: 0,
      }));
      
      expect(result.level).toBe(SufficiencyLevel.INSUFFICIENT);
      expect(result.score).toBe(0);
      expect(result.explain.reasonCode).toBe(SufficiencyReasonCode.NO_BASELINE);
    });
    
    it('should detect insufficient total reviews', () => {
      const ruleSet = createTestRuleSet({
        sufficiencyRules: [
          {
            id: 'insufficient',
            name: 'Insufficient Reviews',
            category: RuleCategory.SUFFICIENCY,
            enabled: true,
            priority: 90,
            conditions: { field: 'totalReviews', operator: 'lt', value: 5 },
            action: {
              level: SufficiencyLevel.INSUFFICIENT,
              confidence: 0,
              reasonCode: SufficiencyReasonCode.INSUFFICIENT_REVIEWS,
            },
          },
        ],
      });
      
      const result = executeSufficiencyRules(ruleSet, createTestFixScoreContext({
        totalReviews: 3,
      }));
      
      expect(result.level).toBe(SufficiencyLevel.INSUFFICIENT);
    });
  });
  
  describe('Confidence Levels', () => {
    const createConfidenceLevelRuleSet = (): RuleSet => createTestRuleSet({
      sufficiencyRules: [
        {
          id: 'high',
          name: 'High Confidence',
          category: RuleCategory.SUFFICIENCY,
          enabled: true,
          priority: 10,
          conditions: { field: 'totalReviews', operator: 'gte', value: 10 },
          action: {
            level: SufficiencyLevel.HIGH,
            confidence: 1.0,
            reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
          },
        },
        {
          id: 'medium',
          name: 'Medium Confidence',
          category: RuleCategory.SUFFICIENCY,
          enabled: true,
          priority: 20,
          conditions: {
            logic: 'and',
            conditions: [
              { field: 'totalReviews', operator: 'gte', value: 5 },
              { field: 'totalReviews', operator: 'lt', value: 10 },
            ],
          },
          action: {
            level: SufficiencyLevel.MEDIUM,
            confidence: 0.7,
            reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
          },
        },
        {
          id: 'low',
          name: 'Low Confidence',
          category: RuleCategory.SUFFICIENCY,
          enabled: true,
          priority: 30,
          conditions: {
            logic: 'and',
            conditions: [
              { field: 'totalReviews', operator: 'gte', value: 2 },
              { field: 'totalReviews', operator: 'lt', value: 5 },
            ],
          },
          action: {
            level: SufficiencyLevel.LOW,
            confidence: 0.4,
            reasonCode: SufficiencyReasonCode.INSUFFICIENT_REVIEWS,
          },
        },
      ],
      defaultSufficiency: {
        level: SufficiencyLevel.INSUFFICIENT,
        confidence: 0,
      },
    });
    
    it('should return HIGH for 10+ reviews', () => {
      const result = executeSufficiencyRules(
        createConfidenceLevelRuleSet(),
        createTestFixScoreContext({ totalReviews: 15 })
      );
      
      expect(result.level).toBe(SufficiencyLevel.HIGH);
      expect(result.score).toBe(1.0);
    });
    
    it('should return MEDIUM for 5-9 reviews', () => {
      const result = executeSufficiencyRules(
        createConfidenceLevelRuleSet(),
        createTestFixScoreContext({ totalReviews: 7 })
      );
      
      expect(result.level).toBe(SufficiencyLevel.MEDIUM);
      expect(result.score).toBe(0.7);
    });
    
    it('should return LOW for 2-4 reviews', () => {
      const result = executeSufficiencyRules(
        createConfidenceLevelRuleSet(),
        createTestFixScoreContext({ totalReviews: 3 })
      );
      
      expect(result.level).toBe(SufficiencyLevel.LOW);
      expect(result.score).toBe(0.4);
    });
    
    it('should return INSUFFICIENT for <2 reviews', () => {
      const result = executeSufficiencyRules(
        createConfidenceLevelRuleSet(),
        createTestFixScoreContext({ totalReviews: 1 })
      );
      
      expect(result.level).toBe(SufficiencyLevel.INSUFFICIENT);
      expect(result.score).toBe(0);
    });
  });
});

// ============================================================
// RULE EXECUTOR CLASS TESTS
// ============================================================

describe('RuleExecutor', () => {
  it('should evaluate confidence for review', () => {
    const executor = new RuleExecutor(getDefaultRuleSet());
    
    // Normal review - should get full confidence
    const result = executor.evaluateConfidence(createTestReview());
    
    expect(result.score).toBeDefined();
    expect(result.explain).toBeDefined();
  });
  
  it('should evaluate sufficiency for fix score', () => {
    const executor = new RuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateSufficiency(createTestFixScoreContext());
    
    expect(result.score).toBeDefined();
    expect(result.level).toBeDefined();
    expect(result.explain).toBeDefined();
  });
  
  it('should return rule set version', () => {
    const executor = new RuleExecutor(getDefaultRuleSet());
    
    expect(executor.getVersion()).toBe('1.0.0');
  });
  
  it('should return stats about rule set', () => {
    const executor = new RuleExecutor(getDefaultRuleSet());
    const stats = executor.getStats();
    
    expect(stats.version).toBe('1.0.0');
    expect(stats.confidenceRulesCount).toBeGreaterThan(0);
    expect(stats.sufficiencyRulesCount).toBeGreaterThan(0);
  });
});

// ============================================================
// DEFAULT RULE SET TESTS
// ============================================================

describe('Default Rule Set', () => {
  it('should detect vague reviews', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateConfidence(createTestReview({
      content: 'Good.',
      contentLength: 5,
    }));
    
    expect(result.score).toBeLessThan(1.0);
    expect(result.explain.reasonCode).toBe(ConfidenceReasonCode.VAGUE_REVIEW);
  });
  
  it('should detect suspected duplicates', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateConfidence(createTestReview({
      duplicateSimilarity: 0.9,
    }));
    
    expect(result.score).toBeLessThan(1.0);
    expect(result.explain.reasonCode).toBe(ConfidenceReasonCode.DUPLICATE_SUSPECTED);
  });
  
  it('should detect spam indicators', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateConfidence(createTestReview({
      content: 'Great!',
      contentLength: 6,
      rating: 5,
    }));
    
    // Short review with extreme rating - spam detected
    expect(result.score).toBeLessThan(0.5);
    expect(result.explain.reasonCode).toBe(ConfidenceReasonCode.SPAM_INDICATORS);
  });
  
  it('should give full confidence to quality reviews', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateConfidence(createTestReview({
      content: 'This restaurant has excellent food and great service. The ambiance is lovely and prices are reasonable. Would definitely recommend!',
      contentLength: 140,
      rating: 4,
      duplicateSimilarity: null,
    }));
    
    expect(result.score).toBe(1.0);
    expect(result.explain.usedDefault).toBe(true);
  });
  
  it('should detect no baseline data for fix score', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateSufficiency(createTestFixScoreContext({
      reviewCountPre: 0,
    }));
    
    expect(result.level).toBe(SufficiencyLevel.INSUFFICIENT);
    expect(result.score).toBe(0);
  });
  
  it('should assign high confidence for sufficient reviews', () => {
    const executor = createRuleExecutor(getDefaultRuleSet());
    
    const result = executor.evaluateSufficiency(createTestFixScoreContext({
      totalReviews: 20,
      reviewCountPre: 10,
      reviewCountPost: 10,
    }));
    
    expect(result.level).toBe(SufficiencyLevel.HIGH);
    expect(result.score).toBe(1.0);
  });
});
