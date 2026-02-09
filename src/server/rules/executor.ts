/**
 * Rule Executor
 * 
 * Evaluates rules against context data and returns scored results
 * with detailed explain payloads.
 */

import type {
  RuleCondition,
  CompoundCondition,
  ComparisonOperator,
  ConfidenceRule,
  SufficiencyRule,
  RuleSet,
  ReviewContext,
  FixScoreContext,
  ConfidenceResult,
  SufficiencyResult,
  RuleMatch,
} from './types';
import {
  RuleCategory,
  ConfidenceReasonCode,
  SufficiencyReasonCode,
  SufficiencyLevel,
  isCompoundCondition,
} from './types';

// ============================================================
// CONDITION EVALUATION
// ============================================================

/**
 * Get a value from an object by dot-notation path
 */
function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Evaluate a comparison operation
 */
function evaluateComparison(
  actual: unknown,
  operator: ComparisonOperator,
  expected: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
      
    case 'neq':
      return actual !== expected;
      
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
      
    case 'nin':
      return Array.isArray(expected) && !expected.includes(actual);
      
    case 'contains':
      return typeof actual === 'string' && 
             typeof expected === 'string' && 
             actual.toLowerCase().includes(expected.toLowerCase());
      
    case 'startsWith':
      return typeof actual === 'string' && 
             typeof expected === 'string' && 
             actual.toLowerCase().startsWith(expected.toLowerCase());
      
    case 'endsWith':
      return typeof actual === 'string' && 
             typeof expected === 'string' && 
             actual.toLowerCase().endsWith(expected.toLowerCase());
      
    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') return false;
      try {
        return new RegExp(expected, 'i').test(actual);
      } catch {
        return false;
      }
      
    default:
      return false;
  }
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: RuleCondition,
  context: Record<string, unknown>
): { matched: boolean; actual: unknown } {
  const actual = getValueByPath(context, condition.field);
  const matched = evaluateComparison(actual, condition.operator, condition.value);
  return { matched, actual };
}

/**
 * Evaluate a compound condition
 */
function evaluateCompoundCondition(
  compound: CompoundCondition,
  context: Record<string, unknown>
): boolean {
  switch (compound.logic) {
    case 'and':
      return compound.conditions.every(c => 
        isCompoundCondition(c) 
          ? evaluateCompoundCondition(c, context)
          : evaluateCondition(c, context).matched
      );
      
    case 'or':
      return compound.conditions.some(c => 
        isCompoundCondition(c) 
          ? evaluateCompoundCondition(c, context)
          : evaluateCondition(c, context).matched
      );
      
    case 'not':
      if (compound.conditions.length !== 1) {
        throw new Error('NOT operator requires exactly one condition');
      }
      const c = compound.conditions[0];
      return isCompoundCondition(c)
        ? !evaluateCompoundCondition(c, context)
        : !evaluateCondition(c, context).matched;
      
    default:
      return false;
  }
}

/**
 * Evaluate any condition (simple or compound)
 */
function evaluateAnyCondition(
  condition: RuleCondition | CompoundCondition,
  context: Record<string, unknown>
): boolean {
  return isCompoundCondition(condition)
    ? evaluateCompoundCondition(condition, context)
    : evaluateCondition(condition, context).matched;
}

/**
 * Get matched conditions for explain payload
 */
function getMatchedConditions(
  condition: RuleCondition | CompoundCondition,
  context: Record<string, unknown>
): Array<{ field: string; operator: ComparisonOperator; expected: unknown; actual: unknown }> {
  const matches: Array<{ field: string; operator: ComparisonOperator; expected: unknown; actual: unknown }> = [];
  
  function collectMatches(cond: RuleCondition | CompoundCondition): void {
    if (isCompoundCondition(cond)) {
      for (const child of cond.conditions) {
        collectMatches(child);
      }
    } else {
      const result = evaluateCondition(cond, context);
      if (result.matched) {
        matches.push({
          field: cond.field,
          operator: cond.operator,
          expected: cond.value,
          actual: result.actual,
        });
      }
    }
  }
  
  collectMatches(condition);
  return matches;
}

// ============================================================
// CONFIDENCE RULE EXECUTOR
// ============================================================

/**
 * Execute confidence rules against a review
 */
export function executeConfidenceRules(
  ruleSet: RuleSet,
  review: ReviewContext
): ConfidenceResult {
  const context = review as unknown as Record<string, unknown>;
  const matches: RuleMatch[] = [];
  
  // Sort rules by priority (descending - higher priority first)
  const sortedRules = [...ruleSet.confidenceRules]
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);
  
  // Evaluate each rule
  for (const rule of sortedRules) {
    const isMatch = evaluateAnyCondition(rule.conditions, context);
    
    if (isMatch) {
      const matchedConditions = getMatchedConditions(rule.conditions, context);
      
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        reasonCode: rule.action.reasonCode,
        reason: rule.action.reasonMessage ?? rule.description ?? rule.name,
        matchedConditions,
      });
    }
  }
  
  // First match wins (highest priority)
  const appliedRule = matches.length > 0 ? matches[0] : null;
  
  if (appliedRule) {
    // Find the rule to get the weight
    const winningRule = sortedRules.find(r => r.id === appliedRule.ruleId)!;
    
    return {
      score: winningRule.action.weight,
      explain: {
        rulesEvaluated: sortedRules.length,
        matches,
        appliedRule,
        usedDefault: false,
        reasonCode: winningRule.action.reasonCode,
      },
    };
  }
  
  // No rules matched - use default
  return {
    score: ruleSet.defaultConfidenceWeight,
    explain: {
      rulesEvaluated: sortedRules.length,
      matches: [],
      appliedRule: null,
      usedDefault: true,
      reasonCode: ConfidenceReasonCode.FULL_CONFIDENCE,
    },
  };
}

// ============================================================
// SUFFICIENCY RULE EXECUTOR
// ============================================================

/**
 * Execute sufficiency rules against FixScore context
 */
export function executeSufficiencyRules(
  ruleSet: RuleSet,
  fixScore: FixScoreContext
): SufficiencyResult {
  const context = fixScore as unknown as Record<string, unknown>;
  const matches: RuleMatch[] = [];
  
  // Sort rules by priority (descending - higher priority first)
  const sortedRules = [...ruleSet.sufficiencyRules]
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);
  
  // Evaluate each rule
  for (const rule of sortedRules) {
    const isMatch = evaluateAnyCondition(rule.conditions, context);
    
    if (isMatch) {
      const matchedConditions = getMatchedConditions(rule.conditions, context);
      
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        reasonCode: rule.action.reasonCode,
        reason: rule.action.reasonMessage ?? rule.description ?? rule.name,
        matchedConditions,
      });
    }
  }
  
  // First match wins (highest priority)
  const appliedRule = matches.length > 0 ? matches[0] : null;
  
  if (appliedRule) {
    // Find the rule to get the level and confidence
    const winningRule = sortedRules.find(r => r.id === appliedRule.ruleId)!;
    
    return {
      score: winningRule.action.confidence,
      level: winningRule.action.level,
      explain: {
        rulesEvaluated: sortedRules.length,
        matches,
        appliedRule,
        usedDefault: false,
        reasonCode: winningRule.action.reasonCode,
      },
    };
  }
  
  // No rules matched - use default
  return {
    score: ruleSet.defaultSufficiency.confidence,
    level: ruleSet.defaultSufficiency.level,
    explain: {
      rulesEvaluated: sortedRules.length,
      matches: [],
      appliedRule: null,
      usedDefault: true,
      reasonCode: SufficiencyReasonCode.SUFFICIENT_DATA,
    },
  };
}

// ============================================================
// RULE SET EXECUTOR
// ============================================================

/**
 * Rule executor class for a specific rule set
 */
export class RuleExecutor {
  private ruleSet: RuleSet;
  
  constructor(ruleSet: RuleSet) {
    this.ruleSet = ruleSet;
  }
  
  /**
   * Execute confidence rules for a review
   */
  evaluateConfidence(review: ReviewContext): ConfidenceResult {
    return executeConfidenceRules(this.ruleSet, review);
  }
  
  /**
   * Execute sufficiency rules for FixScore context
   */
  evaluateSufficiency(fixScore: FixScoreContext): SufficiencyResult {
    return executeSufficiencyRules(this.ruleSet, fixScore);
  }
  
  /**
   * Get the rule set version
   */
  getVersion(): string {
    return this.ruleSet.version;
  }
  
  /**
   * Get statistics about the rule set
   */
  getStats(): {
    version: string;
    confidenceRulesCount: number;
    sufficiencyRulesCount: number;
    enabledConfidenceRules: number;
    enabledSufficiencyRules: number;
  } {
    return {
      version: this.ruleSet.version,
      confidenceRulesCount: this.ruleSet.confidenceRules.length,
      sufficiencyRulesCount: this.ruleSet.sufficiencyRules.length,
      enabledConfidenceRules: this.ruleSet.confidenceRules.filter(r => r.enabled).length,
      enabledSufficiencyRules: this.ruleSet.sufficiencyRules.filter(r => r.enabled).length,
    };
  }
}

/**
 * Create a rule executor from a rule set
 */
export function createRuleExecutor(ruleSet: RuleSet): RuleExecutor {
  return new RuleExecutor(ruleSet);
}
