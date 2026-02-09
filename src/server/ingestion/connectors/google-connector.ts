/**
 * Google Reviews Connector
 * 
 * Handles importing reviews from Google Business Profile.
 * 
 * ## API Limitations
 * 
 * Google does NOT provide a public API for fetching reviews. The options are:
 * 
 * 1. **Google Business Profile API** - Only returns review reply capabilities,
 *    not the actual review content (requires business verification)
 * 
 * 2. **Google My Business API** (deprecated) - Was replaced by Business Profile API
 * 
 * 3. **Places API** - Returns reviews but limited to 5 most recent, not suitable
 *    for comprehensive review management
 * 
 * 4. **Scraping** - Against Google's Terms of Service
 * 
 * ## Implemented Approach: Manual Export Import
 * 
 * Users can export their reviews from Google Takeout:
 * 1. Go to https://takeout.google.com
 * 2. Select "Business Profile" / "Google Business Profile"
 * 3. Download the export (includes reviews.csv)
 * 4. Upload the CSV to Pick'd
 * 
 * This connector handles parsing the Google Takeout format.
 * 
 * ## Future Enhancement Options
 * 
 * If real-time review sync is required:
 * - Partner with a data provider (e.g., DataForSEO, BrightLocal)
 * - Use Google Business Profile API notifications for new reviews
 * - Implement a browser extension for manual capture
 */

import { SourceType, IngestionErrorType } from '@prisma/client';
import { BaseConnector, registerConnector } from '../connector-registry';
import type {
  FetchReviewsOptions,
  FetchReviewsResult,
  ConnectorConfig,
  NormalizedReview,
  ConnectorHealth,
} from '../types';

// ============================================================
// GOOGLE TAKEOUT PARSING
// ============================================================

/**
 * Expected columns in Google Takeout review export
 */
interface GoogleTakeoutReview {
  'Review ID'?: string;
  'Reviewer'?: string;
  'Star Rating'?: string;
  'Review'?: string;
  'Review Reply'?: string;
  'Create Time'?: string;
  'Reply Time'?: string;
}

/**
 * Parse Google Takeout JSON export format
 */
function parseGoogleTakeoutJSON(content: string): NormalizedReview[] {
  const reviews: NormalizedReview[] = [];
  
  try {
    const data = JSON.parse(content);
    
    // Google Takeout format varies, try to handle different structures
    const reviewsArray = Array.isArray(data) ? data : data.reviews || [];
    
    for (const item of reviewsArray) {
      const review: NormalizedReview = {
        externalId: item['Review ID'] || item.reviewId || `google-${Date.now()}-${reviews.length}`,
        content: item['Review'] || item.review || item.comment || '',
        reviewDate: new Date(item['Create Time'] || item.createTime || item.time || new Date()),
        authorName: item['Reviewer'] || item.reviewer || item.author?.displayName || 'Anonymous',
        rating: parseInt(item['Star Rating'] || item.starRating || item.rating) || undefined,
        responseText: item['Review Reply'] || item.reviewReply || item.response?.comment,
        responseDate: item['Reply Time'] || item.replyTime ? 
          new Date(item['Reply Time'] || item.replyTime) : undefined,
        rawData: item,
      };
      
      if (review.content) {
        reviews.push(review);
      }
    }
  } catch {
    // Not valid JSON, will try CSV parsing
  }
  
  return reviews;
}

/**
 * Parse Google Takeout CSV export format
 */
function parseGoogleTakeoutCSV(content: string): NormalizedReview[] {
  const reviews: NormalizedReview[] = [];
  const lines = content.split(/\r?\n/);
  
  if (lines.length < 2) return reviews;
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Find column indices
  const findColumn = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => 
        h.toLowerCase() === name.toLowerCase() ||
        h.toLowerCase().includes(name.toLowerCase())
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };
  
  const reviewIdIdx = findColumn(['Review ID', 'ID', 'review_id']);
  const reviewerIdx = findColumn(['Reviewer', 'Author', 'Name', 'reviewer_name']);
  const ratingIdx = findColumn(['Star Rating', 'Rating', 'Stars', 'star_rating']);
  const contentIdx = findColumn(['Review', 'Comment', 'Text', 'review_text', 'content']);
  const replyIdx = findColumn(['Review Reply', 'Reply', 'Response', 'review_reply']);
  const createTimeIdx = findColumn(['Create Time', 'Date', 'Time', 'create_time', 'created_at']);
  const replyTimeIdx = findColumn(['Reply Time', 'Response Time', 'reply_time']);
  
  if (contentIdx === -1) {
    // Can't find content column
    return reviews;
  }
  
  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (doesn't handle all edge cases - use CSV connector for complex files)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const getValue = (idx: number): string | undefined => {
      if (idx === -1 || idx >= values.length) return undefined;
      return values[idx]?.replace(/^"|"$/g, '').trim() || undefined;
    };
    
    const content = getValue(contentIdx);
    if (!content) continue;
    
    const createTime = getValue(createTimeIdx);
    let reviewDate = new Date();
    if (createTime) {
      const parsed = new Date(createTime);
      if (!isNaN(parsed.getTime())) {
        reviewDate = parsed;
      }
    }
    
    const review: NormalizedReview = {
      externalId: getValue(reviewIdIdx) || `google-csv-${i}`,
      content,
      reviewDate,
      authorName: getValue(reviewerIdx),
      rating: ratingIdx !== -1 ? parseInt(getValue(ratingIdx) || '') || undefined : undefined,
      responseText: getValue(replyIdx),
      rawData: { row: i, values },
    };
    
    if (replyTimeIdx !== -1 && getValue(replyTimeIdx)) {
      const replyTime = new Date(getValue(replyTimeIdx)!);
      if (!isNaN(replyTime.getTime())) {
        review.responseDate = replyTime;
      }
    }
    
    reviews.push(review);
  }
  
  return reviews;
}

// ============================================================
// GOOGLE CONNECTOR IMPLEMENTATION
// ============================================================

export class GoogleConnector extends BaseConnector {
  readonly sourceType = SourceType.GOOGLE;
  readonly displayName = 'Google Reviews';
  readonly supportsAutoSync = false; // No public API available
  readonly requiresUpload = true;
  
  /**
   * Google connector doesn't support live fetching due to API limitations
   */
  async fetchReviews(options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    return {
      reviews: [],
      hasMore: false,
      errors: [this.createError(
        IngestionErrorType.API_ERROR,
        'Google Reviews does not provide a public API for fetching reviews. ' +
        'Please use the manual export feature: ' +
        '1. Go to Google Takeout (takeout.google.com) ' +
        '2. Select "Business Profile" ' +
        '3. Download and upload the export file here.',
        { 
          helpUrl: 'https://takeout.google.com',
          documentation: 'See Google connector documentation for details'
        },
        false
      )],
    };
  }
  
  /**
   * Validate connector configuration
   */
  async validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }> {
    // Google connector doesn't need special config for manual upload
    return { valid: true, errors: [] };
  }
  
  /**
   * Parse uploaded Google Takeout export file
   */
  async parseUpload(
    file: Buffer,
    filename: string,
    config: ConnectorConfig
  ): Promise<FetchReviewsResult> {
    const content = file.toString('utf-8');
    let reviews: NormalizedReview[] = [];
    
    // Determine file type and parse accordingly
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.endsWith('.json')) {
      reviews = parseGoogleTakeoutJSON(content);
    } else if (lowerFilename.endsWith('.csv')) {
      reviews = parseGoogleTakeoutCSV(content);
    } else {
      // Try both parsers
      reviews = parseGoogleTakeoutJSON(content);
      if (reviews.length === 0) {
        reviews = parseGoogleTakeoutCSV(content);
      }
    }
    
    if (reviews.length === 0) {
      return {
        reviews: [],
        hasMore: false,
        errors: [this.createError(
          IngestionErrorType.PARSE_ERROR,
          'Could not parse file. Please ensure this is a Google Takeout export ' +
          'in CSV or JSON format containing review data.',
          { filename, contentPreview: content.substring(0, 200) },
          false
        )],
      };
    }
    
    // Add source metadata
    reviews = reviews.map(review => ({
      ...review,
      rawData: {
        ...review.rawData,
        sourceFile: filename,
        importedAt: new Date().toISOString(),
      },
    }));
    
    return {
      reviews,
      hasMore: false,
      errors: [],
      metadata: {
        filename,
        format: lowerFilename.endsWith('.json') ? 'json' : 'csv',
        totalReviews: reviews.length,
        dateRange: reviews.length > 0 ? {
          earliest: new Date(Math.min(...reviews.map(r => r.reviewDate.getTime()))),
          latest: new Date(Math.max(...reviews.map(r => r.reviewDate.getTime()))),
        } : null,
      },
    };
  }
  
  /**
   * Check health - provides guidance on setup
   */
  async checkHealth(): Promise<ConnectorHealth> {
    return {
      isHealthy: true,
      lastChecked: new Date(),
      details: {
        type: 'manual-export',
        instructions: [
          'Go to https://takeout.google.com',
          'Sign in with your Google Business Profile account',
          'Select "Business Profile" from the list',
          'Click "Next step" and choose export options',
          'Download the export and upload the reviews file here',
        ],
        supportedFormats: ['csv', 'json'],
        limitations: 'Google does not provide a public API for reviews. Manual export is required.',
      },
    };
  }
}

// Register the connector
registerConnector(SourceType.GOOGLE, {
  displayName: 'Google Reviews',
  description: 'Import reviews from Google Business Profile via Google Takeout export',
  supportsAutoSync: false,
  requiresUpload: true,
  factory: (connectorId, config) => new GoogleConnector(connectorId, config),
});

// ============================================================
// DOCUMENTATION
// ============================================================

/**
 * Google Reviews Connector Documentation
 * 
 * ## Why Manual Export?
 * 
 * Google does not provide a public API for accessing business reviews.
 * The available options have significant limitations:
 * 
 * | Option | Limitation |
 * |--------|------------|
 * | Google Business Profile API | Can only reply to reviews, not read them |
 * | Places API | Limited to 5 most recent reviews |
 * | Google My Business API | Deprecated |
 * | Web Scraping | Against Terms of Service |
 * 
 * ## How to Export Reviews
 * 
 * 1. **Google Takeout Method** (Recommended)
 *    - Visit https://takeout.google.com
 *    - Sign in with your Google Business Profile account
 *    - Deselect all, then select "Business Profile"
 *    - Choose export frequency (one-time or scheduled)
 *    - Download and extract the archive
 *    - Upload the reviews CSV/JSON file to Pick'd
 * 
 * 2. **Manual Export from Business Profile** (Alternative)
 *    - Go to Google Business Profile Manager
 *    - Navigate to Reviews section
 *    - Use browser's print/export feature
 *    - Convert to CSV format
 *    - Upload to Pick'd
 * 
 * ## Expected File Format
 * 
 * Google Takeout exports include these columns:
 * - Review ID
 * - Reviewer (display name)
 * - Star Rating (1-5)
 * - Review (text content)
 * - Review Reply (your response)
 * - Create Time (ISO format)
 * - Reply Time (ISO format)
 * 
 * ## Future Considerations
 * 
 * If Google releases a proper Reviews API, this connector can be
 * updated to support automatic sync. Options being monitored:
 * 
 * - Google Business Profile API updates
 * - Official partner integrations
 * - Third-party data providers (DataForSEO, BrightLocal)
 */
export const GOOGLE_CONNECTOR_DOCS = {
  exportUrl: 'https://takeout.google.com',
  businessProfileUrl: 'https://business.google.com',
  apiLimitations: 'Google does not provide a public API for reading reviews',
};
