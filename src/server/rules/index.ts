/**
 * Rules Engine
 * 
 * JSON DSL-based rule system for:
 * - Confidence rules (review-level W_confidence)
 * - Sufficiency rules (FixScore confidence)
 */

// Types
export type {
  RuleCondition,
  CompoundCondition,
  BaseRule,
  ConfidenceRule,
  SufficiencyRule,
  Rule,
  RuleSet,
  ReviewContext,
  FixScoreContext,
  ConfidenceResult,
  SufficiencyResult,
  RuleMatch,
} from './types';

export {
  RuleCategory,
  ConfidenceReasonCode,
  SufficiencyReasonCode,
  SufficiencyLevel,
  isCompoundCondition,
  isConfidenceRule,
  isSufficiencyRule,
} from './types';

// Executor
export {
  RuleExecutor,
  createRuleExecutor,
  executeConfidenceRules,
  executeSufficiencyRules,
} from './executor';

// Defaults
export {
  DEFAULT_RULE_SET,
  DEFAULT_CONFIDENCE_RULES,
  DEFAULT_SUFFICIENCY_RULES,
  getDefaultRuleSet,
} from './defaults';

// Service
export {
  validateRuleSet,
  createRuleSetVersion,
  activateRuleSetVersion,
  getActiveRuleSetVersion,
  getRuleSetVersion,
  listRuleSetVersions,
  getActiveRuleExecutor,
  getRuleExecutorForVersion,
  pinRuleSetToScoreRun,
  getRuleExecutorForScoreRun,
  seedInitialRuleSet,
} from './service';

export type { RuleSetVersionMetadata, RuleSetValidationResult } from './service';
