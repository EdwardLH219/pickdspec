/**
 * Connector Registry
 * 
 * Central registry for all available review source connectors.
 * Handles connector instantiation, configuration, and lifecycle.
 */

import { SourceType } from '@prisma/client';
import type {
  IConnector,
  ConnectorConfig,
  RegisteredConnector,
  ConnectorFactory,
} from './types';
import { decrypt, decryptJSON, isEncrypted } from './encryption';

// ============================================================
// CONNECTOR REGISTRY
// ============================================================

/**
 * Registry of all available connectors
 */
const connectorRegistry = new Map<SourceType, RegisteredConnector>();

/**
 * Register a connector implementation
 */
export function registerConnector(
  sourceType: SourceType,
  info: Omit<RegisteredConnector, 'sourceType'>
): void {
  connectorRegistry.set(sourceType, {
    sourceType,
    ...info,
  });
}

/**
 * Get a registered connector's info
 */
export function getConnectorInfo(sourceType: SourceType): RegisteredConnector | undefined {
  return connectorRegistry.get(sourceType);
}

/**
 * Get all registered connectors
 */
export function getAllConnectors(): RegisteredConnector[] {
  return Array.from(connectorRegistry.values());
}

/**
 * Check if a connector type is registered
 */
export function isConnectorRegistered(sourceType: SourceType): boolean {
  return connectorRegistry.has(sourceType);
}

/**
 * Create a connector instance
 */
export function createConnector(
  sourceType: SourceType,
  connectorId: string,
  encryptedConfig: string | ConnectorConfig | null
): IConnector {
  const registration = connectorRegistry.get(sourceType);
  
  if (!registration) {
    throw new Error(`No connector registered for source type: ${sourceType}`);
  }
  
  // Decrypt config if needed
  let config: ConnectorConfig = {};
  
  if (encryptedConfig) {
    if (typeof encryptedConfig === 'string' && isEncrypted(encryptedConfig)) {
      config = decryptJSON<ConnectorConfig>(encryptedConfig);
    } else if (typeof encryptedConfig === 'object') {
      config = encryptedConfig;
    }
  }
  
  return registration.factory(connectorId, config);
}

// ============================================================
// BASE CONNECTOR CLASS
// ============================================================

/**
 * Abstract base class for connectors with common functionality
 */
export abstract class BaseConnector implements IConnector {
  abstract readonly sourceType: SourceType;
  abstract readonly displayName: string;
  abstract readonly supportsAutoSync: boolean;
  abstract readonly requiresUpload: boolean;
  
  protected readonly connectorId: string;
  protected readonly config: ConnectorConfig;
  
  constructor(connectorId: string, config: ConnectorConfig) {
    this.connectorId = connectorId;
    this.config = config;
  }
  
  /**
   * Fetch reviews - must be implemented by subclasses
   */
  abstract fetchReviews(options: import('./types').FetchReviewsOptions): Promise<import('./types').FetchReviewsResult>;
  
  /**
   * Validate configuration - can be overridden by subclasses
   */
  async validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }> {
    // Default implementation - override in subclasses for specific validation
    return { valid: true, errors: [] };
  }
  
  /**
   * Check health - default implementation
   */
  async checkHealth(): Promise<import('./types').ConnectorHealth> {
    return {
      isHealthy: true,
      lastChecked: new Date(),
    };
  }
  
  /**
   * Parse uploaded file - optional, for file-based connectors
   */
  async parseUpload?(
    file: Buffer,
    filename: string,
    config: ConnectorConfig
  ): Promise<import('./types').FetchReviewsResult>;
  
  /**
   * Helper to create a standardized error
   */
  protected createError(
    type: import('@prisma/client').IngestionErrorType,
    message: string,
    context?: Record<string, unknown>,
    isRetryable = false
  ): import('./types').FetchError {
    return {
      type,
      message,
      context,
      isRetryable,
    };
  }
  
  /**
   * Helper to create an empty result
   */
  protected emptyResult(): import('./types').FetchReviewsResult {
    return {
      reviews: [],
      hasMore: false,
      errors: [],
    };
  }
}

// ============================================================
// CONNECTOR INFO FOR UI
// ============================================================

/**
 * Get connector information for display in UI
 */
export function getConnectorsForUI(): Array<{
  sourceType: SourceType;
  displayName: string;
  description: string;
  supportsAutoSync: boolean;
  requiresUpload: boolean;
  isAvailable: boolean;
}> {
  // All possible source types with their UI info
  const allSourceTypes: Array<{
    sourceType: SourceType;
    displayName: string;
    description: string;
  }> = [
    { sourceType: 'GOOGLE', displayName: 'Google Reviews', description: 'Import reviews from Google Business Profile' },
    { sourceType: 'HELLOPETER', displayName: 'HelloPeter', description: 'Import reviews from HelloPeter.com' },
    { sourceType: 'FACEBOOK', displayName: 'Facebook', description: 'Import reviews from Facebook Page' },
    { sourceType: 'TRIPADVISOR', displayName: 'TripAdvisor', description: 'Import reviews from TripAdvisor' },
    { sourceType: 'YELP', displayName: 'Yelp', description: 'Import reviews from Yelp' },
    { sourceType: 'ZOMATO', displayName: 'Zomato', description: 'Import reviews from Zomato' },
    { sourceType: 'OPENTABLE', displayName: 'OpenTable', description: 'Import reviews from OpenTable' },
    { sourceType: 'WEBSITE', displayName: 'Website/CSV', description: 'Import reviews from CSV file or website export' },
    { sourceType: 'INSTAGRAM', displayName: 'Instagram', description: 'Import reviews from Instagram' },
    { sourceType: 'TWITTER', displayName: 'Twitter/X', description: 'Import reviews from Twitter/X' },
  ];
  
  return allSourceTypes.map(info => {
    const registration = connectorRegistry.get(info.sourceType);
    
    return {
      ...info,
      displayName: registration?.displayName ?? info.displayName,
      description: registration?.description ?? info.description,
      supportsAutoSync: registration?.supportsAutoSync ?? false,
      requiresUpload: registration?.requiresUpload ?? true,
      isAvailable: !!registration,
    };
  });
}
