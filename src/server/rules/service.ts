/**
 * Rule Set Service
 * 
 * Manages rule set versions in the database.
 * Creates immutable versioned records that scoring runs pin to.
 */

import { db } from '@/server/db';
import { RuleStatus, RuleSetCategory } from '@prisma/client';
import type { RuleSet, ConfidenceRule, SufficiencyRule } from './types';
import { RuleCategory, SufficiencyLevel } from './types';
import { RuleExecutor, createRuleExecutor } from './executor';
import { DEFAULT_RULE_SET, getDefaultRuleSet } from './defaults';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

/**
 * Rule set version metadata
 */
export interface RuleSetVersionMetadata {
  versionId: string;
  ruleSetId: string;
  versionNumber: number;
  name: string | null;
  description: string | null;
  status: RuleStatus;
  createdById: string;
  createdAt: Date;
  activatedAt: Date | null;
  activatedById: string | null;
}

/**
 * Validation result for rule sets
 */
export interface RuleSetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate a rule set structure
 */
export function validateRuleSet(ruleSet: unknown): RuleSetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!ruleSet || typeof ruleSet !== 'object') {
    errors.push('Rule set must be an object');
    return { valid: false, errors, warnings };
  }
  
  const rs = ruleSet as Record<string, unknown>;
  
  // Check version
  if (typeof rs.version !== 'string') {
    errors.push('Rule set must have a version string');
  }
  
  // Check confidence rules
  if (!Array.isArray(rs.confidenceRules)) {
    errors.push('confidenceRules must be an array');
  } else {
    for (let i = 0; i < rs.confidenceRules.length; i++) {
      const rule = rs.confidenceRules[i] as ConfidenceRule;
      if (!rule.id) errors.push(`confidenceRules[${i}]: missing id`);
      if (!rule.name) errors.push(`confidenceRules[${i}]: missing name`);
      if (rule.category !== RuleCategory.CONFIDENCE) {
        errors.push(`confidenceRules[${i}]: invalid category`);
      }
      if (!rule.conditions) errors.push(`confidenceRules[${i}]: missing conditions`);
      if (!rule.action) {
        errors.push(`confidenceRules[${i}]: missing action`);
      } else {
        if (typeof rule.action.weight !== 'number' || 
            rule.action.weight < 0 || 
            rule.action.weight > 1) {
          errors.push(`confidenceRules[${i}]: action.weight must be 0-1`);
        }
      }
    }
    
    // Check for duplicate IDs
    const ids = rs.confidenceRules.map((r: ConfidenceRule) => r.id);
    const duplicates = ids.filter((id: string, i: number) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate confidence rule IDs: ${duplicates.join(', ')}`);
    }
  }
  
  // Check sufficiency rules
  if (!Array.isArray(rs.sufficiencyRules)) {
    errors.push('sufficiencyRules must be an array');
  } else {
    for (let i = 0; i < rs.sufficiencyRules.length; i++) {
      const rule = rs.sufficiencyRules[i] as SufficiencyRule;
      if (!rule.id) errors.push(`sufficiencyRules[${i}]: missing id`);
      if (!rule.name) errors.push(`sufficiencyRules[${i}]: missing name`);
      if (rule.category !== RuleCategory.SUFFICIENCY) {
        errors.push(`sufficiencyRules[${i}]: invalid category`);
      }
      if (!rule.conditions) errors.push(`sufficiencyRules[${i}]: missing conditions`);
      if (!rule.action) {
        errors.push(`sufficiencyRules[${i}]: missing action`);
      } else {
        if (typeof rule.action.confidence !== 'number' || 
            rule.action.confidence < 0 || 
            rule.action.confidence > 1) {
          errors.push(`sufficiencyRules[${i}]: action.confidence must be 0-1`);
        }
        if (!Object.values(SufficiencyLevel).includes(rule.action.level)) {
          errors.push(`sufficiencyRules[${i}]: invalid action.level`);
        }
      }
    }
    
    // Check for duplicate IDs
    const ids = rs.sufficiencyRules.map((r: SufficiencyRule) => r.id);
    const duplicates = ids.filter((id: string, i: number) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate sufficiency rule IDs: ${duplicates.join(', ')}`);
    }
  }
  
  // Check defaults
  if (typeof rs.defaultConfidenceWeight !== 'number' || 
      rs.defaultConfidenceWeight < 0 || 
      rs.defaultConfidenceWeight > 1) {
    errors.push('defaultConfidenceWeight must be 0-1');
  }
  
  if (!rs.defaultSufficiency || typeof rs.defaultSufficiency !== 'object') {
    errors.push('defaultSufficiency must be an object');
  } else {
    const ds = rs.defaultSufficiency as { level: SufficiencyLevel; confidence: number };
    if (typeof ds.confidence !== 'number' || ds.confidence < 0 || ds.confidence > 1) {
      errors.push('defaultSufficiency.confidence must be 0-1');
    }
    if (!Object.values(SufficiencyLevel).includes(ds.level)) {
      errors.push('defaultSufficiency.level is invalid');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// RULE SET MANAGEMENT
// ============================================================

/**
 * Get or create the system rule set
 */
async function getOrCreateSystemRuleSet(): Promise<string> {
  // Check if system rule set exists
  const existing = await db.ruleSet.findFirst({
    where: { 
      isSystem: true, 
      category: RuleSetCategory.SCORING,
    },
  });
  
  if (existing) {
    return existing.id;
  }
  
  // Create system rule set
  const ruleSet = await db.ruleSet.create({
    data: {
      name: 'System Scoring Rules',
      description: 'Default confidence and sufficiency rules for scoring',
      category: RuleSetCategory.SCORING,
      isSystem: true,
      isActive: true,
    },
  });
  
  return ruleSet.id;
}

/**
 * Create a new rule set version
 */
export async function createRuleSetVersion(params: {
  rules: RuleSet;
  name?: string;
  description?: string;
  createdById: string;
  organizationId?: string;
}): Promise<{ versionId: string }> {
  const { rules, name, description, createdById, organizationId } = params;
  
  // Validate rules
  const validation = validateRuleSet(rules);
  if (!validation.valid) {
    throw new Error(`Invalid rule set: ${validation.errors.join(', ')}`);
  }
  
  // Get or create the system rule set
  const ruleSetId = await getOrCreateSystemRuleSet();
  
  // Create version
  const version = await db.ruleSetVersion.create({
    data: {
      ruleSetId,
      name,
      description,
      rules: JSON.parse(JSON.stringify(rules)),
      status: RuleStatus.DRAFT,
      createdById,
    },
  });
  
  logger.info({
    versionId: version.id,
    name,
    createdById,
    confidenceRulesCount: rules.confidenceRules.length,
    sufficiencyRulesCount: rules.sufficiencyRules.length,
  }, 'Created rule set version');
  
  return { versionId: version.id };
}

/**
 * Activate a rule set version
 */
export async function activateRuleSetVersion(params: {
  versionId: string;
  activatedById: string;
}): Promise<void> {
  const { versionId, activatedById } = params;
  
  await db.$transaction(async (tx) => {
    const version = await tx.ruleSetVersion.findUnique({
      where: { id: versionId },
    });
    
    if (!version) {
      throw new Error(`Rule set version not found: ${versionId}`);
    }
    
    if (version.status === RuleStatus.ACTIVE) {
      throw new Error('Version is already active');
    }
    
    // Archive current active versions for this rule set
    await tx.ruleSetVersion.updateMany({
      where: { 
        ruleSetId: version.ruleSetId,
        status: RuleStatus.ACTIVE,
      },
      data: { status: RuleStatus.ARCHIVED },
    });
    
    // Activate the new version
    await tx.ruleSetVersion.update({
      where: { id: versionId },
      data: {
        status: RuleStatus.ACTIVE,
        activatedAt: new Date(),
        activatedById,
      },
    });
  });
  
  logger.info({ versionId, activatedById }, 'Activated rule set version');
}

/**
 * Get the currently active rule set version
 */
export async function getActiveRuleSetVersion(): Promise<{
  versionId: string;
  rules: RuleSet;
  metadata: RuleSetVersionMetadata;
} | null> {
  const version = await db.ruleSetVersion.findFirst({
    where: { 
      status: RuleStatus.ACTIVE,
      ruleSet: {
        category: RuleSetCategory.SCORING,
        isSystem: true,
      },
    },
    include: {
      ruleSet: true,
    },
  });
  
  if (!version) return null;
  
  return {
    versionId: version.id,
    rules: version.rules as unknown as RuleSet,
    metadata: {
      versionId: version.id,
      ruleSetId: version.ruleSetId,
      versionNumber: version.versionNumber,
      name: version.name,
      description: version.description,
      status: version.status,
      createdById: version.createdById,
      createdAt: version.createdAt,
      activatedAt: version.activatedAt,
      activatedById: version.activatedById,
    },
  };
}

/**
 * Get a specific rule set version
 */
export async function getRuleSetVersion(versionId: string): Promise<{
  rules: RuleSet;
  metadata: RuleSetVersionMetadata;
} | null> {
  const version = await db.ruleSetVersion.findUnique({
    where: { id: versionId },
  });
  
  if (!version) return null;
  
  return {
    rules: version.rules as unknown as RuleSet,
    metadata: {
      versionId: version.id,
      ruleSetId: version.ruleSetId,
      versionNumber: version.versionNumber,
      name: version.name,
      description: version.description,
      status: version.status,
      createdById: version.createdById,
      createdAt: version.createdAt,
      activatedAt: version.activatedAt,
      activatedById: version.activatedById,
    },
  };
}

/**
 * List rule set versions
 */
export async function listRuleSetVersions(options: {
  status?: RuleStatus;
  limit?: number;
  offset?: number;
}): Promise<RuleSetVersionMetadata[]> {
  const { status, limit = 20, offset = 0 } = options;
  
  const versions = await db.ruleSetVersion.findMany({
    where: {
      ruleSet: {
        category: RuleSetCategory.SCORING,
        isSystem: true,
      },
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
  
  return versions.map(v => ({
    versionId: v.id,
    ruleSetId: v.ruleSetId,
    versionNumber: v.versionNumber,
    name: v.name,
    description: v.description,
    status: v.status,
    createdById: v.createdById,
    createdAt: v.createdAt,
    activatedAt: v.activatedAt,
    activatedById: v.activatedById,
  }));
}

// ============================================================
// EXECUTOR FACTORY
// ============================================================

/**
 * Get a rule executor for the active version
 */
export async function getActiveRuleExecutor(): Promise<{
  executor: RuleExecutor;
  versionId: string;
}> {
  const active = await getActiveRuleSetVersion();
  
  if (active) {
    return {
      executor: createRuleExecutor(active.rules),
      versionId: active.versionId,
    };
  }
  
  // Use default if no active version
  return {
    executor: createRuleExecutor(getDefaultRuleSet()),
    versionId: 'default',
  };
}

/**
 * Get a rule executor for a specific version
 */
export async function getRuleExecutorForVersion(versionId: string): Promise<RuleExecutor | null> {
  if (versionId === 'default') {
    return createRuleExecutor(getDefaultRuleSet());
  }
  
  const version = await getRuleSetVersion(versionId);
  
  if (!version) return null;
  
  return createRuleExecutor(version.rules);
}

// ============================================================
// SCORE RUN INTEGRATION
// ============================================================

/**
 * Pin a rule set version to a score run
 */
export async function pinRuleSetToScoreRun(params: {
  scoreRunId: string;
  ruleSetVersionId: string;
}): Promise<void> {
  const { scoreRunId, ruleSetVersionId } = params;
  
  // Verify version exists
  if (ruleSetVersionId !== 'default') {
    const version = await getRuleSetVersion(ruleSetVersionId);
    if (!version) {
      throw new Error(`Rule set version not found: ${ruleSetVersionId}`);
    }
  }
  
  await db.scoreRun.update({
    where: { id: scoreRunId },
    data: { ruleSetVersionId: ruleSetVersionId === 'default' ? null : ruleSetVersionId },
  });
  
  logger.debug({ scoreRunId, ruleSetVersionId }, 'Pinned rule set to score run');
}

/**
 * Get the rule executor for a score run
 */
export async function getRuleExecutorForScoreRun(scoreRunId: string): Promise<{
  executor: RuleExecutor;
  versionId: string;
}> {
  const scoreRun = await db.scoreRun.findUnique({
    where: { id: scoreRunId },
    select: { ruleSetVersionId: true },
  });
  
  if (!scoreRun) {
    throw new Error(`Score run not found: ${scoreRunId}`);
  }
  
  if (scoreRun.ruleSetVersionId) {
    const executor = await getRuleExecutorForVersion(scoreRun.ruleSetVersionId);
    if (executor) {
      return { executor, versionId: scoreRun.ruleSetVersionId };
    }
  }
  
  // Fall back to active or default
  return getActiveRuleExecutor();
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Seed initial rule set version if none exists
 */
export async function seedInitialRuleSet(createdById: string): Promise<string> {
  // Check if any active version exists
  const existing = await getActiveRuleSetVersion();
  
  if (existing) {
    return existing.versionId;
  }
  
  // Create initial version with defaults
  const { versionId } = await createRuleSetVersion({
    rules: getDefaultRuleSet(),
    name: 'Initial Rules v1.0',
    description: 'Default confidence and sufficiency rules based on Pick\'d scoring specification',
    createdById,
  });
  
  // Activate it
  await activateRuleSetVersion({
    versionId,
    activatedById: createdById,
  });
  
  logger.info({ versionId }, 'Seeded initial rule set version');
  
  return versionId;
}
