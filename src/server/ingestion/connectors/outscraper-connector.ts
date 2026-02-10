/**
 * Outscraper Google Reviews Connector
 * 
 * Imports Google reviews from Outscraper JSON export files.
 * Outscraper provides rich review data including structured ratings
 * (Food, Service, Atmosphere) and author credibility signals.
 * 
 * @see https://outscraper.com/google-maps-reviews-scraper/
 */

import { SourceType, IngestionErrorType } from '@prisma/client';
import { BaseConnector, registerConnector } from '../connector-registry';
import type {
  FetchReviewsOptions,
  FetchReviewsResult,
  ConnectorConfig,
  NormalizedReview,
  FetchError,
  ConnectorHealth,
} from '../types';

// ============================================================
// OUTSCRAPER DATA TYPES
// ============================================================

/**
 * Outscraper review structure (from JSON export)
 */
interface OutscraperReview {
  google_id: string;
  review_id: string;
  review_pagination_id?: string;
  author_link?: string;
  author_title?: string;
  author_id?: string;
  author_image?: string;
  author_reviews_count?: number;
  author_ratings_count?: number;
  review_text?: string | null;
  review_img_urls?: string[] | null;
  review_img_url?: string | null;
  review_questions?: {
    'Meal type'?: string;
    'Price per person'?: string;
    'Food'?: string;
    'Service'?: string;
    'Atmosphere'?: string;
    'Group size'?: string;
    'Wait time'?: string;
    'Seating type'?: string;
    'Parking space'?: string;
    'Parking options'?: string;
    'Noise level'?: string;
    [key: string]: string | undefined;
  } | null;
  review_photo_ids?: string[] | null;
  owner_answer?: string | null;
  owner_answer_timestamp?: number | null;
  owner_answer_timestamp_datetime_utc?: string | null;
  review_link?: string;
  review_rating: number;
  review_timestamp: number;
  review_datetime_utc?: string;
  review_likes?: number | null;
  reviews_id?: string;
}

/**
 * Outscraper place/business data (top-level of JSON)
 */
interface OutscraperPlace {
  query: string;
  name: string;
  place_id: string;
  google_id: string;
  full_address?: string;
  city?: string;
  country?: string;
  rating?: number;
  reviews?: number;
  reviews_tags?: string[];
  reviews_data: OutscraperReview[];
}

/**
 * Extended review data stored in rawData for future use
 */
interface OutscraperExtendedData {
  // Author credibility
  authorReviewsCount?: number;
  authorRatingsCount?: number;
  authorImage?: string;
  
  // Structured ratings (1-5)
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  
  // Additional context
  mealType?: string;
  pricePerPerson?: string;
  groupSize?: string;
  waitTime?: string;
  seatingType?: string;
  parkingInfo?: string;
  noiseLevel?: string;
  
  // Media
  hasImages: boolean;
  imageCount: number;
  
  // Place info
  placeName?: string;
  placeId?: string;
  placeRating?: number;
  placeTotalReviews?: number;
  placeCity?: string;
  reviewsTags?: string[];
}

// ============================================================
// TRANSFORMER FUNCTIONS
// ============================================================

/**
 * Parse structured rating string to number (e.g., "4" -> 4)
 */
function parseStructuredRating(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 1 && num <= 5 ? num : undefined;
}

/**
 * Transform Outscraper review to normalized format
 */
function transformReview(
  review: OutscraperReview,
  place: OutscraperPlace,
  index: number
): NormalizedReview {
  // Parse review timestamp (Unix epoch seconds)
  const reviewDate = new Date(review.review_timestamp * 1000);
  
  // Parse owner response timestamp if exists
  let responseDate: Date | undefined;
  if (review.owner_answer_timestamp) {
    responseDate = new Date(review.owner_answer_timestamp * 1000);
  }
  
  // Build extended data for rawData storage
  const extendedData: OutscraperExtendedData = {
    // Author credibility signals
    authorReviewsCount: review.author_reviews_count,
    authorRatingsCount: review.author_ratings_count,
    authorImage: review.author_image,
    
    // Structured ratings
    foodRating: parseStructuredRating(review.review_questions?.Food),
    serviceRating: parseStructuredRating(review.review_questions?.Service),
    atmosphereRating: parseStructuredRating(review.review_questions?.Atmosphere),
    
    // Context
    mealType: review.review_questions?.['Meal type'],
    pricePerPerson: review.review_questions?.['Price per person'],
    groupSize: review.review_questions?.['Group size'],
    waitTime: review.review_questions?.['Wait time'],
    seatingType: review.review_questions?.['Seating type'],
    parkingInfo: review.review_questions?.['Parking space'] || review.review_questions?.['Parking options'],
    noiseLevel: review.review_questions?.['Noise level'],
    
    // Media
    hasImages: !!(review.review_img_urls?.length || review.review_img_url),
    imageCount: review.review_img_urls?.length || (review.review_img_url ? 1 : 0),
    
    // Place info
    placeName: place.name,
    placeId: place.place_id,
    placeRating: place.rating,
    placeTotalReviews: place.reviews,
    placeCity: place.city,
    reviewsTags: place.reviews_tags,
  };
  
  // Handle reviews without text - create placeholder from structured data
  let content = review.review_text || '';
  if (!content && review.review_questions) {
    // Build content from structured ratings if no text
    const parts: string[] = [];
    if (review.review_questions.Food) {
      parts.push(`Food: ${review.review_questions.Food}/5`);
    }
    if (review.review_questions.Service) {
      parts.push(`Service: ${review.review_questions.Service}/5`);
    }
    if (review.review_questions.Atmosphere) {
      parts.push(`Atmosphere: ${review.review_questions.Atmosphere}/5`);
    }
    content = parts.length > 0 
      ? `[Structured ratings only] ${parts.join(', ')}`
      : '[Rating only - no text content]';
  } else if (!content) {
    content = '[Rating only - no text content]';
  }
  
  return {
    externalId: review.review_id,
    rating: review.review_rating,
    content,
    authorName: review.author_title,
    authorId: review.author_id,
    reviewDate,
    responseText: review.owner_answer || undefined,
    responseDate,
    likesCount: review.review_likes || 0,
    rawData: {
      source: 'outscraper',
      originalReview: review,
      extended: extendedData,
    },
  };
}

// ============================================================
// OUTSCRAPER CONNECTOR IMPLEMENTATION
// ============================================================

export class OutscraperConnector extends BaseConnector {
  readonly sourceType = SourceType.GOOGLE_OUTSCRAPER;
  readonly displayName = 'Google Reviews (Outscraper)';
  readonly supportsAutoSync = false;
  readonly requiresUpload = true;
  
  /**
   * Outscraper connector doesn't support live fetching
   */
  async fetchReviews(options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    return {
      reviews: [],
      hasMore: false,
      errors: [this.createError(
        IngestionErrorType.VALIDATION_ERROR,
        'Outscraper connector requires JSON file upload. Use parseUpload() instead.',
        undefined,
        false
      )],
    };
  }
  
  /**
   * Validate configuration
   */
  async validateConfig(config: ConnectorConfig): Promise<{ valid: boolean; errors: string[] }> {
    // Outscraper connector doesn't require special configuration
    return { valid: true, errors: [] };
  }
  
  /**
   * Parse uploaded Outscraper JSON file
   */
  async parseUpload(
    file: Buffer,
    filename: string,
    config: ConnectorConfig
  ): Promise<FetchReviewsResult> {
    const errors: FetchError[] = [];
    const reviews: NormalizedReview[] = [];
    
    try {
      // Parse JSON content
      const content = file.toString('utf-8');
      let data: OutscraperPlace | OutscraperPlace[];
      
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.PARSE_ERROR,
            `Invalid JSON file: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
            { filename },
            false
          )],
        };
      }
      
      // Handle both single place and array of places
      const places: OutscraperPlace[] = Array.isArray(data) ? data : [data];
      
      if (places.length === 0) {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            'JSON file contains no place data',
            { filename },
            false
          )],
        };
      }
      
      // Process each place
      let totalReviewsProcessed = 0;
      
      for (const place of places) {
        if (!place.reviews_data || !Array.isArray(place.reviews_data)) {
          errors.push(this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            `Place "${place.name || 'Unknown'}" has no reviews_data array`,
            { placeId: place.place_id },
            false
          ));
          continue;
        }
        
        // Transform each review
        for (let i = 0; i < place.reviews_data.length; i++) {
          const outscrapeReview = place.reviews_data[i];
          
          try {
            // Skip reviews without a valid ID
            if (!outscrapeReview.review_id) {
              errors.push(this.createError(
                IngestionErrorType.VALIDATION_ERROR,
                `Review at index ${i} in "${place.name}" has no review_id`,
                { index: i },
                false
              ));
              continue;
            }
            
            // Skip reviews without timestamp
            if (!outscrapeReview.review_timestamp) {
              errors.push(this.createError(
                IngestionErrorType.VALIDATION_ERROR,
                `Review ${outscrapeReview.review_id} has no timestamp`,
                { reviewId: outscrapeReview.review_id },
                false
              ));
              continue;
            }
            
            const normalizedReview = transformReview(outscrapeReview, place, i);
            reviews.push(normalizedReview);
            totalReviewsProcessed++;
          } catch (reviewError) {
            errors.push(this.createError(
              IngestionErrorType.PARSE_ERROR,
              `Failed to transform review at index ${i}: ${reviewError instanceof Error ? reviewError.message : 'Unknown error'}`,
              { index: i, reviewId: outscrapeReview.review_id },
              false
            ));
          }
        }
      }
      
      // Build metadata
      const metadata = {
        filename,
        placesCount: places.length,
        places: places.map(p => ({
          name: p.name,
          placeId: p.place_id,
          city: p.city,
          rating: p.rating,
          totalReviews: p.reviews,
          reviewsInFile: p.reviews_data?.length || 0,
          reviewsTags: p.reviews_tags,
        })),
        totalReviewsInFile: places.reduce((sum, p) => sum + (p.reviews_data?.length || 0), 0),
        successfullyParsed: reviews.length,
        parseErrors: errors.length,
        reviewsWithText: reviews.filter(r => !r.content.startsWith('[Rating only') && !r.content.startsWith('[Structured')).length,
        reviewsWithStructuredRatings: reviews.filter(r => {
          const ext = r.rawData?.extended as OutscraperExtendedData | undefined;
          return ext?.foodRating || ext?.serviceRating || ext?.atmosphereRating;
        }).length,
      };
      
      return {
        reviews,
        hasMore: false,
        errors,
        metadata,
      };
    } catch (error) {
      return {
        reviews: [],
        hasMore: false,
        errors: [this.createError(
          IngestionErrorType.PARSE_ERROR,
          `Failed to process Outscraper JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { filename },
          false
        )],
      };
    }
  }
  
  /**
   * Check health - always healthy for file upload
   */
  async checkHealth(): Promise<ConnectorHealth> {
    return {
      isHealthy: true,
      lastChecked: new Date(),
      details: {
        type: 'file-upload',
        supportedFormats: ['json'],
        source: 'outscraper',
      },
    };
  }
}

// Register the connector
registerConnector(SourceType.GOOGLE_OUTSCRAPER, {
  displayName: 'Google Reviews (Outscraper)',
  description: 'Import Google reviews from Outscraper JSON export with rich metadata',
  supportsAutoSync: false,
  requiresUpload: true,
  factory: (connectorId, config) => new OutscraperConnector(connectorId, config),
});
