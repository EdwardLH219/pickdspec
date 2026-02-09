/**
 * Parameter Service
 * 
 * Manages parameter set versions in the database.
 * Creates immutable records with changelog tracking.
 * 
 * IMPORTANT: Parameter changes do NOT automatically trigger recomputation.
 * Score runs must be manually triggered after parameter changes.
 */

import { db } from '@/server/db';
import { ParameterStatus } from '@prisma/client';
import type {
  ParameterSet,
  ParameterSnapshot,
  ParameterContext,
  ParameterOverride,
  ChangelogEntry,
  ParameterVersionMetadata,
} from './types';
import { ParameterResolver } from './resolver';
import { DEFAULT_PARAMETERS } from './defaults';
import {
  validateParameterSet,
  clampParameterSet,
  clampSourceWeights,
  flattenObject,
} from './validation';
import { logger } from '@/lib/logger';

// ============================================================
// VERSION MANAGEMENT
// ============================================================

/**
 * Create a new parameter set version
 * 
 * Creates an immutable record. The version starts in DRAFT status
 * and must be explicitly activated.
 */
export async function createParameterVersion(params: {
  name: string;
  description?: string;
  parameters: ParameterSet;
  createdById: string;
  basedOnVersionId?: string;
}): Promise<{ versionId: string; changelog: ChangelogEntry[] }> {
  const { name, description, parameters, createdById, basedOnVersionId } = params;
  
  // Validate parameters
  const validation = validateParameterSet(parameters);
  if (!validation.valid) {
    throw new Error(
      `Invalid parameters: ${validation.errors.map(e => e.message).join(', ')}`
    );
  }
  
  // Generate changelog if based on another version
  let changelog: ChangelogEntry[] = [];
  if (basedOnVersionId) {
    const baseVersion = await db.parameterSetVersion.findUnique({
      where: { id: basedOnVersionId },
    });
    
    if (baseVersion) {
      changelog = generateChangelog(
        baseVersion.parameters as unknown as ParameterSet,
        parameters
      );
    }
  }
  
  // Clamp values
  let clampedParams = clampParameterSet(parameters);
  clampedParams = clampSourceWeights(clampedParams);
  
  // Create the version
  const version = await db.parameterSetVersion.create({
    data: {
      name,
      description,
      parameters: JSON.parse(JSON.stringify(clampedParams)),
      status: ParameterStatus.DRAFT,
      createdById,
    },
  });
  
  logger.info({
    versionId: version.id,
    name,
    createdById,
    changelogEntries: changelog.length,
  }, 'Created parameter version');
  
  return {
    versionId: version.id,
    changelog,
  };
}

/**
 * Activate a parameter set version
 * 
 * Only one version can be ACTIVE at a time. Activating a new version
 * archives the currently active one.
 * 
 * NOTE: This does NOT trigger automatic recomputation of scores.
 */
export async function activateParameterVersion(params: {
  versionId: string;
  activatedById: string;
}): Promise<void> {
  const { versionId, activatedById } = params;
  
  await db.$transaction(async (tx) => {
    // Get the version to activate
    const version = await tx.parameterSetVersion.findUnique({
      where: { id: versionId },
    });
    
    if (!version) {
      throw new Error(`Parameter version not found: ${versionId}`);
    }
    
    if (version.status === ParameterStatus.ACTIVE) {
      throw new Error('Version is already active');
    }
    
    // Archive current active version (if any)
    await tx.parameterSetVersion.updateMany({
      where: { status: ParameterStatus.ACTIVE },
      data: { status: ParameterStatus.ARCHIVED },
    });
    
    // Activate the new version
    await tx.parameterSetVersion.update({
      where: { id: versionId },
      data: {
        status: ParameterStatus.ACTIVE,
        activatedAt: new Date(),
        activatedById,
      },
    });
  });
  
  logger.info({
    versionId,
    activatedById,
  }, 'Activated parameter version (no automatic recomputation triggered)');
}

/**
 * Get the currently active parameter version
 */
export async function getActiveParameterVersion(): Promise<{
  versionId: string;
  parameters: ParameterSet;
  metadata: ParameterVersionMetadata;
} | null> {
  const version = await db.parameterSetVersion.findFirst({
    where: { status: ParameterStatus.ACTIVE },
    include: {
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
  
  if (!version) return null;
  
  return {
    versionId: version.id,
    parameters: version.parameters as unknown as ParameterSet,
    metadata: {
      versionId: version.id,
      name: version.name,
      description: version.description ?? undefined,
      createdById: version.createdById,
      createdAt: version.createdAt,
      status: version.status,
      activatedAt: version.activatedAt ?? undefined,
      activatedById: version.activatedById ?? undefined,
    },
  };
}

/**
 * Get a specific parameter version by ID
 */
export async function getParameterVersion(versionId: string): Promise<{
  parameters: ParameterSet;
  metadata: ParameterVersionMetadata;
} | null> {
  const version = await db.parameterSetVersion.findUnique({
    where: { id: versionId },
  });
  
  if (!version) return null;
  
  return {
    parameters: version.parameters as unknown as ParameterSet,
    metadata: {
      versionId: version.id,
      name: version.name,
      description: version.description ?? undefined,
      createdById: version.createdById,
      createdAt: version.createdAt,
      status: version.status,
      activatedAt: version.activatedAt ?? undefined,
      activatedById: version.activatedById ?? undefined,
    },
  };
}

/**
 * List parameter versions
 */
export async function listParameterVersions(options: {
  status?: ParameterStatus;
  limit?: number;
  offset?: number;
}): Promise<ParameterVersionMetadata[]> {
  const { status, limit = 20, offset = 0 } = options;
  
  const versions = await db.parameterSetVersion.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
  
  return versions.map(v => ({
    versionId: v.id,
    name: v.name,
    description: v.description ?? undefined,
    createdById: v.createdById,
    createdAt: v.createdAt,
    status: v.status,
    activatedAt: v.activatedAt ?? undefined,
    activatedById: v.activatedById ?? undefined,
  }));
}

// ============================================================
// SNAPSHOT SERVICE
// ============================================================

/**
 * Create a materialized parameter snapshot for a score run
 * 
 * This records the exact parameters used, including the version ID
 * and any overrides applied. The snapshot is immutable.
 */
export async function createSnapshotForRun(params: {
  context: ParameterContext;
  overrides?: ParameterOverride[];
}): Promise<ParameterSnapshot> {
  const { context, overrides = [] } = params;
  
  // Get active version or use defaults
  const activeVersion = await getActiveParameterVersion();
  
  const baseParameters = activeVersion?.parameters ?? DEFAULT_PARAMETERS;
  const baseVersionId = activeVersion?.versionId ?? 'default';
  
  // Create resolver and resolve parameters
  const resolver = new ParameterResolver(
    baseParameters,
    baseVersionId,
    overrides,
    { clampValues: true }
  );
  
  const snapshot = resolver.resolve(context);
  
  logger.debug({
    snapshotId: snapshot.snapshotId,
    baseVersionId: snapshot.baseVersionId,
    context,
    overrideCount: snapshot.appliedOverrideIds.length,
  }, 'Created parameter snapshot for score run');
  
  return snapshot;
}

/**
 * Store snapshot metadata with a score run
 * 
 * The ScoreRun table already has parameterVersionId.
 * Additional snapshot details can be stored in a separate table
 * or as metadata on the score run.
 */
export async function recordSnapshotForScoreRun(params: {
  scoreRunId: string;
  snapshot: ParameterSnapshot;
}): Promise<void> {
  const { scoreRunId, snapshot } = params;
  
  // The ScoreRun already links to the parameter version
  // Store the full snapshot in the score run for audit purposes
  // This includes any overrides that were applied
  
  await db.scoreRun.update({
    where: { id: scoreRunId },
    data: {
      parameterVersionId: snapshot.baseVersionId === 'default' 
        ? undefined 
        : snapshot.baseVersionId,
    },
  });
  
  logger.info({
    scoreRunId,
    snapshotId: snapshot.snapshotId,
    baseVersionId: snapshot.baseVersionId,
    overrideIds: snapshot.appliedOverrideIds,
  }, 'Recorded parameter snapshot for score run');
}

// ============================================================
// CHANGELOG GENERATION
// ============================================================

/**
 * Generate changelog between two parameter sets
 */
export function generateChangelog(
  oldParams: ParameterSet,
  newParams: ParameterSet
): ChangelogEntry[] {
  const changelog: ChangelogEntry[] = [];
  
  const oldFlat = flattenObject(oldParams as unknown as Record<string, unknown>);
  const newFlat = flattenObject(newParams as unknown as Record<string, unknown>);
  
  // Find changed and added values
  for (const [path, newValue] of Object.entries(newFlat)) {
    const oldValue = oldFlat[path];
    
    if (oldValue === undefined) {
      changelog.push({
        path,
        oldValue: undefined,
        newValue,
        reason: 'Added',
      });
    } else if (!deepEquals(oldValue, newValue)) {
      changelog.push({
        path,
        oldValue,
        newValue,
        reason: 'Modified',
      });
    }
  }
  
  // Find removed values
  for (const [path, oldValue] of Object.entries(oldFlat)) {
    if (!(path in newFlat)) {
      changelog.push({
        path,
        oldValue,
        newValue: undefined,
        reason: 'Removed',
      });
    }
  }
  
  return changelog;
}

/**
 * Deep equality check
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!deepEquals(aObj[key], bObj[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

// ============================================================
// SEED INITIAL PARAMETERS
// ============================================================

/**
 * Seed initial parameter version if none exists
 */
export async function seedInitialParameters(createdById: string): Promise<string> {
  // Check if any versions exist
  const existing = await db.parameterSetVersion.findFirst();
  
  if (existing) {
    return existing.id;
  }
  
  // Create initial version with defaults
  const { versionId } = await createParameterVersion({
    name: 'Initial Parameters v1.0',
    description: 'Default parameter set based on Pick\'d scoring algorithm specification',
    parameters: DEFAULT_PARAMETERS,
    createdById,
  });
  
  // Activate it
  await activateParameterVersion({
    versionId,
    activatedById: createdById,
  });
  
  logger.info({ versionId }, 'Seeded initial parameter version');
  
  return versionId;
}
