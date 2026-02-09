/**
 * CSV Import Connector
 * 
 * Allows importing reviews from CSV files with flexible column mapping.
 * Supports various date formats and handles common CSV quirks.
 */

import { SourceType, IngestionErrorType } from '@prisma/client';
import { BaseConnector, registerConnector } from '../connector-registry';
import type {
  FetchReviewsOptions,
  FetchReviewsResult,
  ConnectorConfig,
  CSVColumnMapping,
  NormalizedReview,
  FetchError,
  ConnectorHealth,
} from '../types';

// ============================================================
// CSV PARSING UTILITIES
// ============================================================

/**
 * Parse CSV content into rows
 * Handles quoted fields, escaped quotes, and various line endings
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        // Windows line ending
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++; // Skip \n
      } else if (char === '\n' || char === '\r') {
        // Unix or old Mac line ending
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  
  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

/**
 * Parse a date string using the specified format
 */
function parseDate(dateStr: string, format?: string): Date | null {
  if (!dateStr) return null;
  
  // Clean the date string
  const cleaned = dateStr.trim();
  
  // Try ISO format first
  const isoDate = new Date(cleaned);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Common date formats to try
  const formats = [
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // DD.MM.YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  ];
  
  // Try format hint
  if (format === 'DD/MM/YYYY' || format === 'dd/mm/yyyy') {
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  if (format === 'MM/DD/YYYY' || format === 'mm/dd/yyyy') {
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, month, day, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  // Try common formats
  // DD/MM/YYYY or MM/DD/YYYY - assume DD/MM/YYYY for non-US
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    // If first number > 12, it must be day
    if (parseInt(a) > 12) {
      return new Date(parseInt(year), parseInt(b) - 1, parseInt(a));
    }
    // Default to DD/MM/YYYY
    return new Date(parseInt(year), parseInt(b) - 1, parseInt(a));
  }
  
  // YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
}

/**
 * Generate a unique ID from review content
 */
function generateReviewId(review: Partial<NormalizedReview>, index: number): string {
  const content = review.content || '';
  const date = review.reviewDate?.toISOString() || '';
  const author = review.authorName || '';
  
  // Create a simple hash
  const str = `${content.substring(0, 50)}|${date}|${author}|${index}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `csv-${Math.abs(hash).toString(36)}-${index}`;
}

// ============================================================
// CSV CONNECTOR IMPLEMENTATION
// ============================================================

export class CSVConnector extends BaseConnector {
  readonly sourceType = SourceType.WEBSITE;
  readonly displayName = 'CSV Import';
  readonly supportsAutoSync = false;
  readonly requiresUpload = true;
  
  /**
   * CSV connector doesn't support live fetching
   */
  async fetchReviews(options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    return {
      reviews: [],
      hasMore: false,
      errors: [this.createError(
        IngestionErrorType.VALIDATION_ERROR,
        'CSV connector requires file upload. Use parseUpload() instead.',
        undefined,
        false
      )],
    };
  }
  
  /**
   * Validate CSV column mapping configuration
   */
  async validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const mapping = config.columnMappings;
    
    if (!mapping) {
      errors.push('Column mapping configuration is required');
      return { valid: false, errors };
    }
    
    if (!mapping.content) {
      errors.push('Content column mapping is required');
    }
    
    if (!mapping.reviewDate) {
      errors.push('Review date column mapping is required');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Parse uploaded CSV file
   */
  async parseUpload(
    file: Buffer,
    filename: string,
    config: ConnectorConfig
  ): Promise<FetchReviewsResult> {
    const errors: FetchError[] = [];
    const reviews: NormalizedReview[] = [];
    
    // Validate config
    const validation = await this.validateConfig(config);
    if (!validation.valid) {
      return {
        reviews: [],
        hasMore: false,
        errors: validation.errors.map(msg => this.createError(
          IngestionErrorType.VALIDATION_ERROR,
          msg,
          undefined,
          false
        )),
      };
    }
    
    const mapping = config.columnMappings!;
    
    try {
      // Decode file content
      const content = file.toString('utf-8');
      
      // Parse CSV
      const rows = parseCSV(content);
      
      if (rows.length < 2) {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            'CSV file must have a header row and at least one data row',
            undefined,
            false
          )],
        };
      }
      
      // Get header row and create column index map
      const headers = rows[0];
      const columnIndex: Record<string, number> = {};
      headers.forEach((header, index) => {
        columnIndex[header.toLowerCase().trim()] = index;
        columnIndex[header.trim()] = index;
      });
      
      // Helper to get column index from mapping
      const getColumnIndex = (mappingValue: string | undefined): number | undefined => {
        if (!mappingValue) return undefined;
        
        // Try exact match first
        if (columnIndex[mappingValue] !== undefined) {
          return columnIndex[mappingValue];
        }
        
        // Try case-insensitive match
        if (columnIndex[mappingValue.toLowerCase()] !== undefined) {
          return columnIndex[mappingValue.toLowerCase()];
        }
        
        // Try as column number (0-indexed)
        const colNum = parseInt(mappingValue);
        if (!isNaN(colNum) && colNum >= 0 && colNum < headers.length) {
          return colNum;
        }
        
        return undefined;
      };
      
      // Get column indices
      const contentIdx = getColumnIndex(mapping.content);
      const dateIdx = getColumnIndex(mapping.reviewDate);
      const ratingIdx = getColumnIndex(mapping.rating);
      const titleIdx = getColumnIndex(mapping.title);
      const authorIdx = getColumnIndex(mapping.authorName);
      const externalIdIdx = getColumnIndex(mapping.externalId);
      const responseTextIdx = getColumnIndex(mapping.responseText);
      const responseDateIdx = getColumnIndex(mapping.responseDate);
      
      if (contentIdx === undefined) {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            `Content column "${mapping.content}" not found in CSV headers`,
            { headers, mapping },
            false
          )],
        };
      }
      
      if (dateIdx === undefined) {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            `Review date column "${mapping.reviewDate}" not found in CSV headers`,
            { headers, mapping },
            false
          )],
        };
      }
      
      // Process data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1; // 1-indexed for user display
        
        try {
          // Get content (required)
          const content = row[contentIdx];
          if (!content || content.trim() === '') {
            errors.push(this.createError(
              IngestionErrorType.VALIDATION_ERROR,
              `Row ${rowNum}: Empty content`,
              { row },
              false
            ));
            continue;
          }
          
          // Get and parse date (required)
          const dateStr = row[dateIdx];
          const reviewDate = parseDate(dateStr, mapping.dateFormat);
          if (!reviewDate) {
            errors.push(this.createError(
              IngestionErrorType.PARSE_ERROR,
              `Row ${rowNum}: Invalid date format "${dateStr}"`,
              { row, dateFormat: mapping.dateFormat },
              false
            ));
            continue;
          }
          
          // Build review object
          const review: NormalizedReview = {
            externalId: externalIdIdx !== undefined ? row[externalIdIdx] : '',
            content: content.trim(),
            reviewDate,
          };
          
          // Generate ID if not provided
          if (!review.externalId) {
            review.externalId = generateReviewId(review, i);
          }
          
          // Optional fields
          if (ratingIdx !== undefined && row[ratingIdx]) {
            const rating = parseInt(row[ratingIdx]);
            if (!isNaN(rating) && rating >= 1 && rating <= 5) {
              review.rating = rating;
            }
          }
          
          if (titleIdx !== undefined && row[titleIdx]) {
            review.title = row[titleIdx].trim();
          }
          
          if (authorIdx !== undefined && row[authorIdx]) {
            review.authorName = row[authorIdx].trim();
          }
          
          if (responseTextIdx !== undefined && row[responseTextIdx]) {
            review.responseText = row[responseTextIdx].trim();
            
            if (responseDateIdx !== undefined && row[responseDateIdx]) {
              const responseDate = parseDate(row[responseDateIdx], mapping.dateFormat);
              if (responseDate) {
                review.responseDate = responseDate;
              }
            }
          }
          
          // Store raw row data
          review.rawData = {
            sourceFile: filename,
            rowNumber: rowNum,
            originalRow: row,
          };
          
          reviews.push(review);
        } catch (rowError) {
          errors.push(this.createError(
            IngestionErrorType.PARSE_ERROR,
            `Row ${rowNum}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`,
            { row },
            false
          ));
        }
      }
      
      return {
        reviews,
        hasMore: false,
        errors,
        metadata: {
          filename,
          totalRows: rows.length - 1,
          successfulRows: reviews.length,
          failedRows: errors.length,
          headers,
        },
      };
    } catch (error) {
      return {
        reviews: [],
        hasMore: false,
        errors: [this.createError(
          IngestionErrorType.PARSE_ERROR,
          `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          false
        )],
      };
    }
  }
  
  /**
   * Check health - always healthy for CSV
   */
  async checkHealth(): Promise<ConnectorHealth> {
    return {
      isHealthy: true,
      lastChecked: new Date(),
      details: {
        type: 'file-upload',
        supportedFormats: ['csv'],
      },
    };
  }
}

/**
 * Default column mappings for common CSV formats
 */
export const CSV_PRESET_MAPPINGS: Record<string, CSVColumnMapping> = {
  'google-takeout': {
    content: 'Review',
    reviewDate: 'Create Time',
    rating: 'Star Rating',
    authorName: 'Reviewer',
    dateFormat: 'YYYY-MM-DD',
  },
  'generic': {
    content: 'content',
    reviewDate: 'date',
    rating: 'rating',
    title: 'title',
    authorName: 'author',
    dateFormat: 'YYYY-MM-DD',
  },
};

// Register the connector
registerConnector(SourceType.WEBSITE, {
  displayName: 'CSV Import',
  description: 'Import reviews from CSV files with flexible column mapping',
  supportsAutoSync: false,
  requiresUpload: true,
  factory: (connectorId, config) => new CSVConnector(connectorId, config),
});
