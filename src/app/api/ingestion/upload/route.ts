/**
 * File Upload Ingestion API Route
 * 
 * POST /api/ingestion/upload - Upload a file and run ingestion
 * 
 * Supports:
 * - CSV files with column mapping
 * - Google Takeout exports (CSV/JSON)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, getTenantAccess } from '@/lib/auth/config';
import { db } from '@/server/db';
import { startIngestion, isIngestionRunning } from '@/server/ingestion/ingestion-service';
import { decryptJSON, isEncrypted } from '@/server/ingestion/encryption';
import { IngestionRunType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type { ConnectorConfig } from '@/server/ingestion/types';

// Import connectors to register them
import '@/server/ingestion/connectors/csv-connector';
import '@/server/ingestion/connectors/google-connector';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/json',
  'application/vnd.ms-excel',
];

const ALLOWED_EXTENSIONS = ['.csv', '.json', '.txt'];

/**
 * POST /api/ingestion/upload
 * 
 * Upload a file and run ingestion
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners, managers, and admins can upload
    if (!['OWNER', 'MANAGER', 'PICKD_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to upload files' },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    
    const file = formData.get('file') as File | null;
    const connectorId = formData.get('connectorId') as string | null;
    const columnMappingsJson = formData.get('columnMappings') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!connectorId) {
      return NextResponse.json({ error: 'Connector ID is required' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get connector
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
      include: { tenant: true },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied to this connector' }, { status: 403 });
    }

    // Check if ingestion is already running
    const isRunning = await isIngestionRunning(connectorId);
    if (isRunning) {
      return NextResponse.json(
        { error: 'An ingestion run is already in progress for this connector' },
        { status: 409 }
      );
    }

    // Get connector config and merge with column mappings if provided
    let config: ConnectorConfig = {};
    
    if (connector.externalConfig) {
      const configStr = connector.externalConfig as string;
      if (isEncrypted(configStr)) {
        config = decryptJSON<ConnectorConfig>(configStr);
      }
    }

    // Parse column mappings from request if provided
    if (columnMappingsJson) {
      try {
        const columnMappings = JSON.parse(columnMappingsJson);
        config = {
          ...config,
          columnMappings,
        };
      } catch {
        return NextResponse.json(
          { error: 'Invalid column mappings JSON' },
          { status: 400 }
        );
      }
    }

    // For CSV connector, ensure we have column mappings
    if (connector.sourceType === 'WEBSITE' && !config.columnMappings) {
      return NextResponse.json(
        { 
          error: 'Column mappings required for CSV import',
          hint: 'Provide columnMappings with at least "content" and "reviewDate" fields',
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info({
      connectorId,
      tenantId: connector.tenantId,
      userId: session.user.id,
      filename: file.name,
      fileSize: file.size,
    }, 'Starting file upload ingestion');

    // Start the ingestion with uploaded file
    const result = await startIngestion({
      tenantId: connector.tenantId,
      connectorId,
      runType: IngestionRunType.MANUAL,
      uploadedFile: {
        buffer,
        filename: file.name,
        mimeType: file.type,
      },
    });

    return NextResponse.json({
      success: true,
      run: {
        id: result.runId,
        status: result.status,
        reviewsFetched: result.reviewsFetched,
        reviewsCreated: result.reviewsCreated,
        reviewsUpdated: result.reviewsUpdated,
        reviewsSkipped: result.reviewsSkipped,
        duplicatesFound: result.duplicatesFound,
        errorCount: result.errorCount,
        durationMs: result.durationMs,
        errors: result.errors.slice(0, 10), // Only return first 10 errors
      },
      message: getStatusMessage(result),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to process file upload');
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    );
  }
}

/**
 * Generate a human-readable status message
 */
function getStatusMessage(result: { 
  status: string; 
  reviewsCreated: number; 
  reviewsUpdated: number;
  reviewsSkipped: number;
  duplicatesFound: number;
  errorCount: number;
}): string {
  const parts: string[] = [];
  
  if (result.reviewsCreated > 0) {
    parts.push(`${result.reviewsCreated} new reviews imported`);
  }
  if (result.reviewsUpdated > 0) {
    parts.push(`${result.reviewsUpdated} updated`);
  }
  if (result.duplicatesFound > 0) {
    parts.push(`${result.duplicatesFound} duplicates skipped`);
  }
  if (result.errorCount > 0) {
    parts.push(`${result.errorCount} errors`);
  }
  
  if (parts.length === 0) {
    return result.status === 'COMPLETED' ? 'No new reviews found' : 'Processing completed';
  }
  
  return parts.join(', ');
}
