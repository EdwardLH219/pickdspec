/**
 * Ingestion Module
 * 
 * Central export point for the review ingestion system.
 */

// Types
export type {
  IConnector,
  NormalizedReview,
  FetchReviewsResult,
  FetchReviewsOptions,
  FetchError,
  ConnectorConfig,
  CSVColumnMapping,
  ConnectorHealth,
  StartIngestionParams,
  PartialFetchOptions,
  IngestionRunResult,
  IngestionProgress,
  RegisteredConnector,
} from './types';

// Encryption (server-side only)
export {
  encrypt,
  decrypt,
  decryptJSON,
  isEncrypted,
  maskSecret,
  generateApiKey,
} from './encryption';

// Connector registry
export {
  registerConnector,
  getConnectorInfo,
  getAllConnectors,
  isConnectorRegistered,
  createConnector,
  getConnectorsForUI,
  BaseConnector,
} from './connector-registry';

// CSV connector presets
export { CSV_PRESET_MAPPINGS } from './connectors/csv-connector';

// Google connector docs
export { GOOGLE_CONNECTOR_DOCS } from './connectors/google-connector';

// Ingestion service
export {
  startIngestion,
  updateConnectorConfig,
  getConnectorConfig,
  getIngestionHistory,
  getIngestionErrors,
  isIngestionRunning,
} from './ingestion-service';
