/**
 * Parameter Validation
 * 
 * Validates parameter sets against bounds and required keys.
 * Supports clamping values to valid ranges.
 */

import type {
  ParameterSet,
  PartialParameterSet,
  ValidationResult,
  ValidationError,
  ParameterBounds,
} from './types';
import {
  PARAMETER_BOUNDS,
  REQUIRED_SECTIONS,
  REQUIRED_KEYS,
  DEFAULT_PARAMETERS,
} from './defaults';

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate a complete parameter set
 */
export function validateParameterSet(params: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  if (!params || typeof params !== 'object') {
    errors.push({
      path: '',
      message: 'Parameter set must be an object',
      value: params,
    });
    return { valid: false, errors, warnings };
  }
  
  const paramSet = params as Record<string, unknown>;
  
  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!(section in paramSet)) {
      errors.push({
        path: section,
        message: `Missing required section: ${section}`,
      });
    } else if (typeof paramSet[section] !== 'object' || paramSet[section] === null) {
      errors.push({
        path: section,
        message: `Section ${section} must be an object`,
        value: paramSet[section],
      });
    }
  }
  
  // Check required keys within sections
  for (const [section, keys] of Object.entries(REQUIRED_KEYS)) {
    const sectionData = paramSet[section] as Record<string, unknown> | undefined;
    if (!sectionData) continue;
    
    for (const key of keys) {
      const value = sectionData[key];
      if (value === undefined) {
        errors.push({
          path: `${section}.${key}`,
          message: `Missing required key: ${section}.${key}`,
        });
      }
    }
  }
  
  // Validate bounds for all defined bounds
  for (const [path, bounds] of Object.entries(PARAMETER_BOUNDS)) {
    const value = getValueByPath(paramSet, path);
    
    if (value === undefined) {
      if (bounds.required) {
        errors.push({
          path,
          message: `Missing required parameter: ${path}`,
          bounds,
        });
      }
      continue;
    }
    
    // Check enum values
    if (bounds.enum && !bounds.enum.includes(value)) {
      errors.push({
        path,
        message: `Invalid value for ${path}. Must be one of: ${bounds.enum.join(', ')}`,
        value,
        bounds,
      });
    }
    
    // Check numeric bounds
    if (typeof value === 'number') {
      if (bounds.min !== undefined && value < bounds.min) {
        warnings.push({
          path,
          message: `Value ${value} is below minimum ${bounds.min} for ${path}`,
          value,
          bounds,
        });
      }
      if (bounds.max !== undefined && value > bounds.max) {
        warnings.push({
          path,
          message: `Value ${value} is above maximum ${bounds.max} for ${path}`,
          value,
          bounds,
        });
      }
    }
  }
  
  // Validate confidence thresholds ordering
  const confidenceThresholds = paramSet.fix_tracking as Record<string, unknown> | undefined;
  if (confidenceThresholds?.confidence_thresholds) {
    const thresholds = confidenceThresholds.confidence_thresholds as Record<string, number>;
    if (thresholds.low >= thresholds.medium) {
      errors.push({
        path: 'fix_tracking.confidence_thresholds',
        message: 'low threshold must be less than medium threshold',
        value: thresholds,
      });
    }
    if (thresholds.medium >= thresholds.high) {
      errors.push({
        path: 'fix_tracking.confidence_thresholds',
        message: 'medium threshold must be less than high threshold',
        value: thresholds,
      });
    }
  }
  
  // Validate source weight ordering
  const source = paramSet.source as Record<string, unknown> | undefined;
  if (source) {
    const minWeight = source.min_weight as number;
    const maxWeight = source.max_weight as number;
    if (minWeight !== undefined && maxWeight !== undefined && minWeight >= maxWeight) {
      errors.push({
        path: 'source',
        message: 'min_weight must be less than max_weight',
        value: { min_weight: minWeight, max_weight: maxWeight },
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a partial parameter set (for overrides)
 */
export function validatePartialParameterSet(params: PartialParameterSet): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // For partial sets, we only validate the values that are present
  const flatParams = flattenObject(params);
  
  for (const [path, value] of Object.entries(flatParams)) {
    const bounds = PARAMETER_BOUNDS[path];
    
    if (!bounds) {
      // Unknown parameter path - warning only
      warnings.push({
        path,
        message: `Unknown parameter path: ${path}`,
        value,
      });
      continue;
    }
    
    // Check enum values
    if (bounds.enum && !bounds.enum.includes(value)) {
      errors.push({
        path,
        message: `Invalid value for ${path}. Must be one of: ${bounds.enum.join(', ')}`,
        value,
        bounds,
      });
    }
    
    // Check numeric bounds (warning, will be clamped)
    if (typeof value === 'number') {
      if (bounds.min !== undefined && value < bounds.min) {
        warnings.push({
          path,
          message: `Value ${value} is below minimum ${bounds.min} for ${path}`,
          value,
          bounds,
        });
      }
      if (bounds.max !== undefined && value > bounds.max) {
        warnings.push({
          path,
          message: `Value ${value} is above maximum ${bounds.max} for ${path}`,
          value,
          bounds,
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// CLAMPING
// ============================================================

/**
 * Clamp a single value to its bounds
 */
export function clampValue(path: string, value: number): number {
  const bounds = PARAMETER_BOUNDS[path];
  
  if (!bounds) return value;
  
  let clamped = value;
  
  if (bounds.min !== undefined && clamped < bounds.min) {
    clamped = bounds.min;
  }
  
  if (bounds.max !== undefined && clamped > bounds.max) {
    clamped = bounds.max;
  }
  
  return clamped;
}

/**
 * Clamp all numeric values in a parameter set to their bounds
 * Note: Source weights are skipped here and handled by clampSourceWeights()
 * which uses the dynamic min/max from the parameter set itself
 */
export function clampParameterSet(params: ParameterSet): ParameterSet {
  const clamped = JSON.parse(JSON.stringify(params)) as ParameterSet;
  
  for (const [path, bounds] of Object.entries(PARAMETER_BOUNDS)) {
    if (bounds.min === undefined && bounds.max === undefined) continue;
    
    // Skip source weights - they are handled by clampSourceWeights()
    if (path.startsWith('source.weights.')) continue;
    
    const value = getValueByPath(clamped, path);
    if (typeof value !== 'number') continue;
    
    const clampedValue = clampValue(path, value);
    if (clampedValue !== value) {
      setValueByPath(clamped, path, clampedValue);
    }
  }
  
  return clamped;
}

/**
 * Apply dynamic source weight clamping using the parameter set's own min/max
 */
export function clampSourceWeights(params: ParameterSet): ParameterSet {
  const clamped = JSON.parse(JSON.stringify(params)) as ParameterSet;
  const { min_weight, max_weight, weights } = clamped.source;
  
  for (const [source, weight] of Object.entries(weights)) {
    if (typeof weight === 'number') {
      const clampedWeight = Math.max(min_weight, Math.min(max_weight, weight));
      (weights as Record<string, number>)[source] = clampedWeight;
    }
  }
  
  return clamped;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get a value from an object by dot-notation path
 */
export function getValueByPath(obj: unknown, path: string): unknown {
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
 * Set a value in an object by dot-notation path
 */
export function setValueByPath(obj: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj as Record<string, unknown>;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Flatten an object to dot-notation paths
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, path));
    } else {
      result[path] = value;
    }
  }
  
  return result;
}

/**
 * Check if a parameter set has all required keys
 */
export function hasRequiredKeys(params: unknown): params is ParameterSet {
  const validation = validateParameterSet(params);
  return validation.valid;
}

/**
 * Fill in missing required values with defaults
 */
export function fillDefaults(params: PartialParameterSet): ParameterSet {
  return deepMerge(
    DEFAULT_PARAMETERS as unknown as Record<string, unknown>,
    params as Record<string, unknown>
  ) as unknown as ParameterSet;
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown>
): T {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      key in base &&
      base[key] !== null &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}
