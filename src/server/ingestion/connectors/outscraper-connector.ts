/**
 * Multi-Source Reviews Connector (Outscraper/Google/Booking)
 * 
 * Imports reviews from various JSON export formats:
 * - Original Outscraper format (reviews_data array)
 * - Merged format (place object + reviews array)
 * - Reviews-only format (just reviews array, mixed sources)
 * 
 * Supports Google and Booking.com reviews with automatic source detection.
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

// Source type for individual reviews (detected from 'source' field)
type ReviewSourceType = 'google' | 'booking' | 'unknown';

// ============================================================
// OUTSCRAPER DATA TYPES
// ============================================================

/**
 * Outscraper review structure - ORIGINAL FORMAT (from JSON export)
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
 * Outscraper place/business data - ORIGINAL FORMAT (top-level of JSON)
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

// ============================================================
// ALTERNATE "MERGED" FORMAT TYPES
// ============================================================

/**
 * Alternate review structure - MERGED FORMAT
 * Field mapping: text->review_text, rating->review_rating, author->author_title,
 * timestamp->review_timestamp, sub_ratings->review_questions
 */
interface MergedFormatReview {
  source: string;
  review_id: string;
  rating: number;
  rating_scale?: number;
  text?: string | null;
  date?: string;
  timestamp: number;
  review_likes?: number | null;
  sub_ratings?: {
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
    'Reservation'?: string;
    [key: string]: string | undefined | null;
  } | null;
  owner_answer?: string | null;
  owner_answer_date?: string | null;
  author: string;
  author_id?: string;
  author_reviews_count?: number;
  has_photos?: boolean;
  photo_count?: number;
  review_link?: string;
}

/**
 * Alternate place structure - MERGED FORMAT (nested in "place" object)
 */
interface MergedFormatPlace {
  name: string;
  full_address?: string;
  rating?: number;
  total_reviews?: number | null;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  phone?: string;
  site?: string | null;
  place_id: string;
}

/**
 * Top-level structure for MERGED FORMAT
 */
interface MergedFormatData {
  name: string;
  slug?: string;
  place: MergedFormatPlace;
  reviews: MergedFormatReview[];
  sources?: { [key: string]: number };
  fetched_at?: string;
}

// ============================================================
// REVIEWS-ONLY FORMAT TYPES
// ============================================================

/**
 * Reviews-only format - just an array of reviews at root
 * Used when place metadata is not included
 */
interface ReviewsOnlyData {
  reviews: (MergedFormatReview | BookingReview)[];
}

// ============================================================
// BOOKING.COM FORMAT TYPES
// ============================================================

/**
 * Booking.com review structure
 */
interface BookingReview {
  source: 'booking';
  review_id: string;
  rating: number;
  rating_scale: number;
  rating_original?: number;
  rating_original_scale?: number;
  text?: string | null;
  text_liked?: string | null;
  text_disliked?: string | null;
  review_title?: string | null;
  date?: string;
  timestamp: number;
  owner_answer?: string | null;
  author: string;
  author_id?: string;
  author_country?: string;
  author_type?: string;
  author_room?: string;
  author_stay_date?: string;
  author_stay_period?: string;
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
// FORMAT DETECTION & NORMALIZATION
// ============================================================

type DataFormat = 'original' | 'merged' | 'reviews_only' | 'unknown';

/**
 * Detect which format the parsed JSON is in
 */
function detectFormat(data: unknown): DataFormat {
  if (!data || typeof data !== 'object') return 'unknown';
  
  // Check for array of original format places
  if (Array.isArray(data)) {
    if (data.length > 0 && 'reviews_data' in data[0]) {
      return 'original';
    }
    return 'unknown';
  }
  
  // Check for single object
  const obj = data as Record<string, unknown>;
  
  // Original format: has reviews_data array at root
  if ('reviews_data' in obj && Array.isArray(obj.reviews_data)) {
    return 'original';
  }
  
  // Merged format: has nested "place" object and "reviews" array (not reviews_data)
  if ('place' in obj && typeof obj.place === 'object' && 
      'reviews' in obj && Array.isArray(obj.reviews) &&
      !('reviews_data' in obj)) {
    return 'merged';
  }
  
  // Reviews-only format: just has "reviews" array at root (no place object)
  if ('reviews' in obj && Array.isArray(obj.reviews) && !('place' in obj)) {
    return 'reviews_only';
  }
  
  return 'unknown';
}

/**
 * Detect the source type of an individual review
 */
function detectReviewSource(review: Record<string, unknown>): ReviewSourceType {
  const source = review.source as string | undefined;
  if (source === 'booking') return 'booking';
  if (source === 'google') return 'google';
  // If no source field but has google-specific fields, assume google
  if ('google_id' in review || 'review_questions' in review || 'sub_ratings' in review) {
    return 'google';
  }
  // If has booking-specific fields
  if ('text_liked' in review || 'text_disliked' in review || 'author_room' in review) {
    return 'booking';
  }
  return 'unknown';
}

/**
 * Convert a merged format review to original format
 */
function normalizeMergedReview(review: MergedFormatReview, placeId: string): OutscraperReview {
  // Parse owner_answer_date to timestamp if present
  let ownerAnswerTimestamp: number | undefined;
  if (review.owner_answer_date) {
    const parsed = new Date(review.owner_answer_date);
    if (!isNaN(parsed.getTime())) {
      ownerAnswerTimestamp = Math.floor(parsed.getTime() / 1000);
    }
  }
  
  // Build image URLs array from has_photos/photo_count
  const reviewImgUrls: string[] | null = review.has_photos && review.photo_count 
    ? Array(review.photo_count).fill('[photo]') 
    : null;
  
  return {
    google_id: placeId,
    review_id: review.review_id,
    author_title: review.author,
    author_id: review.author_id,
    author_reviews_count: review.author_reviews_count,
    review_text: review.text,
    review_img_urls: reviewImgUrls,
    review_questions: review.sub_ratings ? 
      Object.fromEntries(
        Object.entries(review.sub_ratings).filter(([, v]) => v !== null)
      ) as OutscraperReview['review_questions'] : null,
    owner_answer: review.owner_answer,
    owner_answer_timestamp: ownerAnswerTimestamp,
    review_link: review.review_link,
    review_rating: review.rating,
    review_timestamp: review.timestamp,
    review_datetime_utc: review.date,
    review_likes: review.review_likes,
  };
}

/**
 * Convert merged format data to original format place array
 */
function normalizeMergedFormat(data: MergedFormatData): OutscraperPlace[] {
  const place: OutscraperPlace = {
    query: data.name,
    name: data.name,
    place_id: data.place.place_id,
    google_id: data.place.place_id,
    full_address: data.place.full_address,
    city: data.place.city,
    country: data.place.country,
    rating: data.place.rating,
    reviews: data.place.total_reviews ?? data.reviews.length,
    reviews_data: data.reviews
      .filter(r => (r as { source?: string }).source !== 'booking')
      .map(r => normalizeMergedReview(r as MergedFormatReview, data.place.place_id)),
  };
  
  return [place];
}

/**
 * Parse international date strings (handles Lithuanian, German, Spanish, etc.)
 * Patterns: "2025 m. gruodžio 24 d." (Lithuanian), "24. Dezember 2025" (German), etc.
 */
function parseInternationalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Lithuanian format: "2025 m. gruodžio 24 d."
  const lithuanianMatch = dateStr.match(/(\d{4})\s*m\.\s*(\S+)\s+(\d{1,2})\s*d\./);
  if (lithuanianMatch) {
    const year = parseInt(lithuanianMatch[1]);
    const monthStr = lithuanianMatch[2].toLowerCase();
    const day = parseInt(lithuanianMatch[3]);
    
    let month = -1;
    if (monthStr.startsWith('saus')) month = 0;       // January
    else if (monthStr.startsWith('vasar')) month = 1; // February
    else if (monthStr.startsWith('kov')) month = 2;   // March
    else if (monthStr.startsWith('balan')) month = 3; // April
    else if (monthStr.startsWith('gegu')) month = 4;  // May
    else if (monthStr.startsWith('bir')) month = 5;   // June
    else if (monthStr.startsWith('liep')) month = 6;  // July
    else if (monthStr.startsWith('rugp')) month = 7;  // August
    else if (monthStr.startsWith('rugs')) month = 8;  // September
    else if (monthStr.startsWith('spal')) month = 9;  // October
    else if (monthStr.startsWith('lapkr')) month = 10; // November
    else if (monthStr.startsWith('gruod')) month = 11; // December
    
    if (month !== -1) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }
  
  // Standard date format: "MM/DD/YYYY HH:MM:SS" or "DD/MM/YYYY"
  const standardMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (standardMatch) {
    const part1 = parseInt(standardMatch[1]);
    const part2 = parseInt(standardMatch[2]);
    const year = parseInt(standardMatch[3]);
    // Assume MM/DD/YYYY format (US style)
    return new Date(year, part1 - 1, part2, 12, 0, 0);
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
    return parsed;
  }
  
  return null;
}

/**
 * Safely parse a timestamp, with fallback to date string parsing
 */
function safeParseTimestamp(timestamp: number, dateString?: string | null): Date {
  // Check for invalid/negative timestamps
  if (timestamp <= 0 || timestamp < 0) {
    // Try parsing the date string instead
    if (dateString) {
      const parsed = parseInternationalDate(dateString);
      if (parsed) return parsed;
    }
    // Default to current date if all else fails
    return new Date();
  }
  
  const date = new Date(timestamp * 1000);
  
  // Sanity check: if date is before 1990 or after 2100, it's likely corrupted
  if (date.getFullYear() < 1990 || date.getFullYear() > 2100) {
    if (dateString) {
      const parsed = parseInternationalDate(dateString);
      if (parsed) return parsed;
    }
    return new Date();
  }
  
  return date;
}

/**
 * Normalize HTML content - decode entities and convert line breaks
 * Handles both HTML entities (&lt;br&gt;) and actual tags (<br>)
 */
function normalizeHtmlContent(content: string): string {
  if (!content) return content;
  
  let normalized = content;
  
  // First decode HTML entities
  normalized = normalized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Convert <br> tags to newlines (handles <br>, <br/>, <br />)
  normalized = normalized.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove other common HTML tags that might slip through
  normalized = normalized.replace(/<\/?(?:p|div|span)[^>]*>/gi, '\n');
  
  // Clean up excessive whitespace while preserving paragraph structure
  normalized = normalized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return normalized;
}

/**
 * Transform a Booking.com review to normalized format
 */
function transformBookingReview(review: BookingReview, index: number): NormalizedReview {
  // Use safe timestamp parsing with date string fallback
  const reviewDate = safeParseTimestamp(review.timestamp, review.date);
  
  // Combine text_liked and text_disliked into content
  let content = review.text || '';
  if (!content) {
    const parts: string[] = [];
    if (review.text_liked) {
      parts.push(`Liked: ${review.text_liked}`);
    }
    if (review.text_disliked) {
      parts.push(`Disliked: ${review.text_disliked}`);
    }
    content = parts.join(' | ') || '[Rating only - no text content]';
  }
  
  // Normalize HTML entities and line breaks
  content = normalizeHtmlContent(content);
  
  return {
    externalId: review.review_id,
    rating: review.rating,
    content,
    authorName: review.author,
    authorId: review.author_id,
    reviewDate,
    responseText: review.owner_answer ? normalizeHtmlContent(review.owner_answer) : undefined,
    responseDate: undefined,
    likesCount: 0,
    sourceType: SourceType.BOOKING,
    rawData: {
      source: 'booking',
      originalReview: review,
      extended: {
        authorCountry: review.author_country,
        authorType: review.author_type,
        authorRoom: review.author_room,
        stayDate: review.author_stay_date,
        stayPeriod: review.author_stay_period,
        reviewTitle: review.review_title,
        ratingOriginal: review.rating_original,
        ratingOriginalScale: review.rating_original_scale,
        textLiked: review.text_liked,
        textDisliked: review.text_disliked,
      },
    },
  };
}

// ============================================================
// TRANSFORMER FUNCTIONS
// ============================================================

/**
 * Parse structured rating string to number (e.g., "4" -> 4)
 */
function parseStructuredRating(value: string | undefined | null): number | undefined {
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
  // Parse review timestamp with safe fallback to date string
  const reviewDate = safeParseTimestamp(review.review_timestamp, review.review_datetime_utc);
  
  // Parse owner response timestamp if exists
  let responseDate: Date | undefined;
  if (review.owner_answer_timestamp && review.owner_answer_timestamp > 0) {
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
  
  // Normalize HTML entities and line breaks
  content = normalizeHtmlContent(content);
  
  return {
    externalId: review.review_id,
    rating: review.review_rating,
    content,
    authorName: review.author_title,
    authorId: review.author_id,
    reviewDate,
    responseText: review.owner_answer ? normalizeHtmlContent(review.owner_answer) : undefined,
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
  readonly displayName = 'Google Reviews (API)';
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
   * Supports both original format (reviews_data) and merged format (reviews + place)
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
      let rawData: unknown;
      
      try {
        rawData = JSON.parse(content);
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
      
      // Detect format and normalize to original format
      const format = detectFormat(rawData);
      let places: OutscraperPlace[] = [];
      let bookingReviews: BookingReview[] = [];
      let googleReviewsOnly: MergedFormatReview[] = [];
      
      if (format === 'merged') {
        // Normalize merged format to original format
        const mergedData = rawData as MergedFormatData;
        places = normalizeMergedFormat(mergedData);
        // Extract booking reviews separately
        bookingReviews = mergedData.reviews
          .filter(r => (r as { source?: string }).source === 'booking') as BookingReview[];
      } else if (format === 'original') {
        // Already in original format
        const data = rawData as OutscraperPlace | OutscraperPlace[];
        places = Array.isArray(data) ? data : [data];
      } else if (format === 'reviews_only') {
        // Reviews-only format - no place metadata
        const reviewsData = rawData as ReviewsOnlyData;
        // Separate Google and Booking reviews
        for (const review of reviewsData.reviews) {
          const source = detectReviewSource(review as unknown as Record<string, unknown>);
          if (source === 'booking') {
            bookingReviews.push(review as BookingReview);
          } else {
            googleReviewsOnly.push(review as MergedFormatReview);
          }
        }
      } else {
        return {
          reviews: [],
          hasMore: false,
          errors: [this.createError(
            IngestionErrorType.VALIDATION_ERROR,
            `Unrecognized JSON format. Expected "reviews_data" array (original), "place" + "reviews" (merged), or just "reviews" array (reviews-only).`,
            { filename },
            false
          )],
        };
      }
      
      // Process places (original and merged formats)
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
      
      // Process reviews-only Google reviews (no place metadata)
      for (let i = 0; i < googleReviewsOnly.length; i++) {
        const review = googleReviewsOnly[i];
        try {
          if (!review.review_id) {
            errors.push(this.createError(
              IngestionErrorType.VALIDATION_ERROR,
              `Google review at index ${i} has no review_id`,
              { index: i },
              false
            ));
            continue;
          }
          if (!review.timestamp) {
            errors.push(this.createError(
              IngestionErrorType.VALIDATION_ERROR,
              `Google review ${review.review_id} has no timestamp`,
              { reviewId: review.review_id },
              false
            ));
            continue;
          }
          
          // Create a minimal place object for reviews-only format
          const minimalPlace: OutscraperPlace = {
            query: 'Unknown',
            name: 'Unknown',
            place_id: 'reviews-only',
            google_id: 'reviews-only',
            reviews_data: [],
          };
          const normalizedReview = normalizeMergedReview(review, 'reviews-only');
          const transformed = transformReview(normalizedReview, minimalPlace, i);
          reviews.push(transformed);
          totalReviewsProcessed++;
        } catch (reviewError) {
          errors.push(this.createError(
            IngestionErrorType.PARSE_ERROR,
            `Failed to transform Google review at index ${i}: ${reviewError instanceof Error ? reviewError.message : 'Unknown error'}`,
            { index: i, reviewId: review.review_id },
            false
          ));
        }
      }
      
      // Process Booking.com reviews
      let bookingCount = 0;
      for (let i = 0; i < bookingReviews.length; i++) {
        const review = bookingReviews[i];
        try {
          if (!review.review_id) {
            errors.push(this.createError(
              IngestionErrorType.VALIDATION_ERROR,
              `Booking review at index ${i} has no review_id`,
              { index: i },
              false
            ));
            continue;
          }
          if (!review.timestamp) {
            errors.push(this.createError(
              IngestionErrorType.VALIDATION_ERROR,
              `Booking review ${review.review_id} has no timestamp`,
              { reviewId: review.review_id },
              false
            ));
            continue;
          }
          
          const normalizedReview = transformBookingReview(review, i);
          reviews.push(normalizedReview);
          bookingCount++;
          totalReviewsProcessed++;
        } catch (reviewError) {
          errors.push(this.createError(
            IngestionErrorType.PARSE_ERROR,
            `Failed to transform Booking review at index ${i}: ${reviewError instanceof Error ? reviewError.message : 'Unknown error'}`,
            { index: i, reviewId: review.review_id },
            false
          ));
        }
      }
      
      // Build metadata
      const totalReviewsInFile = 
        places.reduce((sum, p) => sum + (p.reviews_data?.length || 0), 0) +
        googleReviewsOnly.length +
        bookingReviews.length;
      
      const metadata = {
        filename,
        detectedFormat: format,
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
        totalReviewsInFile,
        successfullyParsed: reviews.length,
        parseErrors: errors.length,
        reviewsWithText: reviews.filter(r => !r.content.startsWith('[Rating only') && !r.content.startsWith('[Structured')).length,
        reviewsWithStructuredRatings: reviews.filter(r => {
          const ext = r.rawData?.extended as OutscraperExtendedData | undefined;
          return ext?.foodRating || ext?.serviceRating || ext?.atmosphereRating;
        }).length,
        sourceBreakdown: {
          google: reviews.length - bookingCount,
          booking: bookingCount,
        },
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
  displayName: 'Google Reviews (API)',
  description: 'Import reviews from JSON export (supports Google & Booking.com, multiple formats)',
  supportsAutoSync: false,
  requiresUpload: true,
  factory: (connectorId, config) => new OutscraperConnector(connectorId, config),
});
