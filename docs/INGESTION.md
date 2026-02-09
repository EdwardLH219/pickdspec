# Ingestion Framework

The Pick'd Review Intelligence platform includes a flexible ingestion framework for importing review data from various sources.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API Routes                                │
│  /api/ingestion/connectors  /api/ingestion/run              │
│  /api/ingestion/upload      /api/ingestion/runs/[id]        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Ingestion Service                            │
│  - Orchestrates ingestion runs                               │
│  - Tracks progress and errors                                │
│  - Saves normalized reviews to database                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Connector Registry                              │
│  - Registers available connector types                       │
│  - Creates connector instances                               │
│  - Manages connector configuration                           │
└──────────┬───────────────────────────────┬──────────────────┘
           │                               │
┌──────────▼──────────┐     ┌──────────────▼──────────────────┐
│   CSV Connector     │     │      Google Connector           │
│   (WEBSITE)         │     │      (GOOGLE)                   │
│   - File upload     │     │      - Manual export import     │
│   - Column mapping  │     │      - Takeout format support   │
└─────────────────────┘     └─────────────────────────────────┘
```

## Connector Interface

All connectors implement the `IConnector` interface:

```typescript
interface IConnector {
  readonly sourceType: SourceType;
  readonly displayName: string;
  readonly supportsAutoSync: boolean;
  readonly requiresUpload: boolean;
  
  fetchReviews(options: FetchReviewsOptions): Promise<FetchReviewsResult>;
  validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }>;
  checkHealth(): Promise<ConnectorHealth>;
  parseUpload?(file: Buffer, filename: string, config: ConnectorConfig): Promise<FetchReviewsResult>;
}
```

## Normalized Review Format

All connectors produce reviews in a normalized format:

```typescript
interface NormalizedReview {
  externalId: string;        // ID from source platform
  rating?: number;           // 1-5 star rating
  title?: string;            // Review title
  content: string;           // Review body text
  authorName?: string;       // Reviewer display name
  authorId?: string;         // Reviewer ID on source
  reviewDate: Date;          // When review was posted
  responseText?: string;     // Business response
  responseDate?: Date;       // When business responded
  detectedLanguage?: string; // e.g., 'en', 'af'
  rawData?: Record<string, unknown>; // Original data for audit
}
```

## V1 Connectors

### CSV Import Connector

The CSV connector allows importing reviews from CSV files with flexible column mapping.

**Usage:**
1. Create a connector with `sourceType: 'WEBSITE'`
2. Configure column mappings in the connector config:
   ```json
   {
     "columnMappings": {
       "content": "Review",
       "reviewDate": "Date",
       "rating": "Rating",
       "authorName": "Author",
       "dateFormat": "DD/MM/YYYY"
     }
   }
   ```
3. Upload a CSV file through the `/api/ingestion/upload` endpoint

**Supported date formats:**
- `YYYY-MM-DD`
- `DD/MM/YYYY`
- `MM/DD/YYYY`
- ISO 8601

### Google Reviews Connector

Google does not provide a public API for fetching reviews. The connector supports manual export import via Google Takeout.

**Why Manual Export?**

| Option | Limitation |
|--------|------------|
| Google Business Profile API | Can only reply to reviews, not read them |
| Places API | Limited to 5 most recent reviews |
| Web Scraping | Against Terms of Service |

**How to Export Reviews:**
1. Go to https://takeout.google.com
2. Sign in with your Google Business Profile account
3. Select "Business Profile" from the list
4. Download and extract the archive
5. Upload the reviews CSV/JSON file to Pick'd

**Supported Formats:**
- Google Takeout CSV format
- Google Takeout JSON format

## Encryption

Connector configurations containing secrets (API keys, OAuth tokens) are encrypted using AES-256-GCM before storage.

```typescript
// Encrypt config before saving
const encryptedConfig = encrypt(config);

// Decrypt when reading
const config = decryptJSON<ConnectorConfig>(encryptedConfig);
```

**Environment Variables:**
- `CONNECTOR_ENCRYPTION_KEY` - 64-character hex string (32 bytes)
- In development, if not set, a key is derived from `AUTH_SECRET`

## Ingestion Run Tracking

Every ingestion run is tracked with:

```typescript
interface IngestionRunResult {
  runId: string;
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  
  // Counts
  reviewsFetched: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  reviewsSkipped: number;
  duplicatesFound: number;
  errorCount: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Errors
  errors: FetchError[];
}
```

## API Endpoints

### Connectors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ingestion/connectors` | List connectors |
| POST | `/api/ingestion/connectors` | Create connector |
| GET | `/api/ingestion/connectors/[id]` | Get connector details |
| PATCH | `/api/ingestion/connectors/[id]` | Update connector |
| DELETE | `/api/ingestion/connectors/[id]` | Delete connector |

### Ingestion Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingestion/run` | Start ingestion run |
| POST | `/api/ingestion/upload` | Upload file and run ingestion |
| GET | `/api/ingestion/runs/[id]` | Get run details |

## Permissions

| Action | PICKD_ADMIN | OWNER | MANAGER | STAFF |
|--------|-------------|-------|---------|-------|
| View connectors | ✓ | ✓ | ✓ | - |
| Create connector | ✓ | ✓ | - | - |
| Modify secrets | ✓ | ✓ | - | - |
| Delete connector | ✓ | ✓ | - | - |
| Run ingestion | ✓ | ✓ | ✓ | - |
| Upload files | ✓ | ✓ | ✓ | - |

## UI Pages

### Admin: `/admin/ingestion`
- View all connectors across all tenants
- Run ingestion for any connector
- Upload files
- View recent run history

### Portal: `/data-sources`
- View connectors for user's tenants
- Upload files
- Request/run ingestion (role-dependent)

## Adding a New Connector

1. Create a new file in `src/server/ingestion/connectors/`
2. Extend `BaseConnector` class
3. Implement required methods
4. Register the connector:
   ```typescript
   registerConnector(SourceType.NEW_SOURCE, {
     displayName: 'New Source',
     description: 'Import from new source',
     supportsAutoSync: false,
     requiresUpload: true,
     factory: (connectorId, config) => new NewConnector(connectorId, config),
   });
   ```

## Future Considerations

- **Auto-sync:** If/when APIs become available, connectors can set `supportsAutoSync: true` and implement scheduled fetching
- **Rate limiting:** Add rate limiting for API-based connectors
- **Webhook support:** Accept push notifications from sources
- **Data providers:** Integrate with third-party data providers (DataForSEO, BrightLocal) for sources without public APIs
