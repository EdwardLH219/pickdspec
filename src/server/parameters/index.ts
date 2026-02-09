/**
 * Parameter Engine
 * 
 * Manages scoring parameters with hierarchical precedence:
 * global → tenant → branch → source → theme
 */

// Types
export type {
  ParameterSet,
  PartialParameterSet,
  SentimentParameters,
  TimeParameters,
  SourceParameters,
  EngagementParameters,
  ConfidenceParameters,
  FixTrackingParameters,
  ParameterContext,
  ParameterSnapshot,
  ParameterOverride,
  ParameterBounds,
  ValidationResult,
  ValidationError,
  ChangelogEntry,
  ParameterVersionMetadata,
  ResolutionTraceEntry,
} from './types';

export { OverrideScope, SCOPE_PRECEDENCE } from './types';

// Defaults
export { DEFAULT_PARAMETERS, PARAMETER_BOUNDS, REQUIRED_SECTIONS, REQUIRED_KEYS } from './defaults';

// Validation
export {
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
} from './validation';

// Resolver
export {
  ParameterResolver,
  createDefaultResolver,
  resolveParameters,
  globalOverride,
  tenantOverride,
  branchOverride,
  sourceOverride,
  themeOverride,
} from './resolver';

// Service
export {
  createParameterVersion,
  activateParameterVersion,
  getActiveParameterVersion,
  getParameterVersion,
  listParameterVersions,
  createSnapshotForRun,
  recordSnapshotForScoreRun,
  generateChangelog,
  seedInitialParameters,
} from './service';
