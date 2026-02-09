/**
 * Parameter Resolver
 * 
 * Resolves parameters with hierarchical precedence:
 * global → tenant → branch → source → theme
 * 
 * Later levels override earlier levels.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ParameterSet,
  PartialParameterSet,
  ParameterContext,
  ParameterSnapshot,
  ParameterOverride,
  ResolutionTraceEntry,
} from './types';
import { OverrideScope, SCOPE_PRECEDENCE } from './types';
import { DEFAULT_PARAMETERS } from './defaults';
import {
  deepMerge,
  clampParameterSet,
  clampSourceWeights,
  flattenObject,
} from './validation';

// ============================================================
// PARAMETER RESOLVER
// ============================================================

/**
 * Configuration for the resolver
 */
export interface ResolverConfig {
  /** Whether to enable resolution tracing */
  enableTrace?: boolean;
  
  /** Whether to clamp values after resolution */
  clampValues?: boolean;
}

/**
 * Parameter resolver class
 */
export class ParameterResolver {
  private baseParameters: ParameterSet;
  private baseVersionId: string;
  private overrides: ParameterOverride[];
  private config: ResolverConfig;
  
  constructor(
    baseParameters: ParameterSet,
    baseVersionId: string,
    overrides: ParameterOverride[] = [],
    config: ResolverConfig = {}
  ) {
    this.baseParameters = baseParameters;
    this.baseVersionId = baseVersionId;
    this.overrides = overrides;
    this.config = {
      enableTrace: config.enableTrace ?? false,
      clampValues: config.clampValues ?? true,
    };
  }
  
  /**
   * Resolve parameters for a given context
   */
  resolve(context: ParameterContext = {}): ParameterSnapshot {
    const appliedOverrideIds: string[] = [];
    const resolutionTrace: ResolutionTraceEntry[] = [];
    
    // Start with base parameters
    let resolved = JSON.parse(JSON.stringify(this.baseParameters)) as ParameterSet;
    
    // Track base values in trace
    if (this.config.enableTrace) {
      const baseFlat = flattenObject(this.baseParameters as unknown as Record<string, unknown>);
      for (const [path, value] of Object.entries(baseFlat)) {
        resolutionTrace.push({
          path,
          value,
          source: 'base',
          sourceId: this.baseVersionId,
          scope: OverrideScope.GLOBAL,
        });
      }
    }
    
    // Get applicable overrides sorted by precedence
    const applicableOverrides = this.getApplicableOverrides(context);
    
    // Apply overrides in precedence order
    for (const override of applicableOverrides) {
      if (!override.isActive) continue;
      
      // Merge override into resolved parameters
      resolved = deepMerge(
        resolved as unknown as Record<string, unknown>,
        override.overrides as Record<string, unknown>
      ) as unknown as ParameterSet;
      appliedOverrideIds.push(override.scopeId);
      
      // Track override values in trace
      if (this.config.enableTrace) {
        const overrideFlat = flattenObject(override.overrides as Record<string, unknown>);
        for (const [path, value] of Object.entries(overrideFlat)) {
          if (value !== undefined) {
            resolutionTrace.push({
              path,
              value,
              source: 'override',
              sourceId: override.scopeId,
              scope: override.scope,
            });
          }
        }
      }
    }
    
    // Apply clamping if enabled
    if (this.config.clampValues) {
      resolved = clampParameterSet(resolved);
      resolved = clampSourceWeights(resolved);
    }
    
    return {
      snapshotId: uuidv4(),
      baseVersionId: this.baseVersionId,
      appliedOverrideIds,
      parameters: resolved,
      context,
      createdAt: new Date(),
      resolutionTrace: this.config.enableTrace ? resolutionTrace : undefined,
    };
  }
  
  /**
   * Get overrides applicable to a context, sorted by precedence
   */
  private getApplicableOverrides(context: ParameterContext): ParameterOverride[] {
    const applicable: ParameterOverride[] = [];
    
    // Process each scope level in precedence order
    for (const scope of SCOPE_PRECEDENCE) {
      const scopeOverrides = this.overrides
        .filter(o => o.scope === scope && o.isActive)
        .filter(o => this.isOverrideApplicable(o, context, scope))
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      
      applicable.push(...scopeOverrides);
    }
    
    return applicable;
  }
  
  /**
   * Check if an override is applicable to a context
   */
  private isOverrideApplicable(
    override: ParameterOverride,
    context: ParameterContext,
    scope: OverrideScope
  ): boolean {
    switch (scope) {
      case OverrideScope.GLOBAL:
        return true;
        
      case OverrideScope.TENANT:
        return context.tenantId !== undefined && override.scopeId === context.tenantId;
        
      case OverrideScope.BRANCH:
        return context.branchId !== undefined && override.scopeId === context.branchId;
        
      case OverrideScope.SOURCE:
        return context.sourceType !== undefined && 
          override.scopeId.toLowerCase() === context.sourceType.toLowerCase();
        
      case OverrideScope.THEME:
        return context.themeId !== undefined && override.scopeId === context.themeId;
        
      default:
        return false;
    }
  }
  
  /**
   * Get the final value for a specific parameter path
   */
  resolveValue(path: string, context: ParameterContext = {}): unknown {
    const snapshot = this.resolve(context);
    return getValueByPath(snapshot.parameters, path);
  }
}

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

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

/**
 * Create a resolver with default parameters
 */
export function createDefaultResolver(
  overrides: ParameterOverride[] = [],
  config?: ResolverConfig
): ParameterResolver {
  return new ParameterResolver(
    DEFAULT_PARAMETERS,
    'default',
    overrides,
    config
  );
}

/**
 * Quick resolve with defaults
 */
export function resolveParameters(
  context: ParameterContext = {},
  overrides: ParameterOverride[] = []
): ParameterSnapshot {
  const resolver = createDefaultResolver(overrides);
  return resolver.resolve(context);
}

// ============================================================
// OVERRIDE BUILDERS
// ============================================================

/**
 * Create a global override
 */
export function globalOverride(
  overrides: PartialParameterSet,
  options: { priority?: number; isActive?: boolean } = {}
): ParameterOverride {
  return {
    scope: OverrideScope.GLOBAL,
    scopeId: 'global',
    overrides,
    priority: options.priority ?? 0,
    isActive: options.isActive ?? true,
  };
}

/**
 * Create a tenant override
 */
export function tenantOverride(
  tenantId: string,
  overrides: PartialParameterSet,
  options: { priority?: number; isActive?: boolean } = {}
): ParameterOverride {
  return {
    scope: OverrideScope.TENANT,
    scopeId: tenantId,
    overrides,
    priority: options.priority ?? 0,
    isActive: options.isActive ?? true,
  };
}

/**
 * Create a branch override
 */
export function branchOverride(
  branchId: string,
  overrides: PartialParameterSet,
  options: { priority?: number; isActive?: boolean } = {}
): ParameterOverride {
  return {
    scope: OverrideScope.BRANCH,
    scopeId: branchId,
    overrides,
    priority: options.priority ?? 0,
    isActive: options.isActive ?? true,
  };
}

/**
 * Create a source override
 */
export function sourceOverride(
  sourceType: string,
  overrides: PartialParameterSet,
  options: { priority?: number; isActive?: boolean } = {}
): ParameterOverride {
  return {
    scope: OverrideScope.SOURCE,
    scopeId: sourceType.toLowerCase(),
    overrides,
    priority: options.priority ?? 0,
    isActive: options.isActive ?? true,
  };
}

/**
 * Create a theme override
 */
export function themeOverride(
  themeId: string,
  overrides: PartialParameterSet,
  options: { priority?: number; isActive?: boolean } = {}
): ParameterOverride {
  return {
    scope: OverrideScope.THEME,
    scopeId: themeId,
    overrides,
    priority: options.priority ?? 0,
    isActive: options.isActive ?? true,
  };
}
