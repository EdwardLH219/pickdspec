/**
 * Output Sanitization
 * 
 * Utilities to sanitize user-generated content for safe display,
 * preventing XSS and other injection attacks.
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 * 
 * @param text - Raw text to sanitize
 * @returns Escaped text safe for HTML display
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  
  return text.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize review content for safe display
 * - Escapes HTML entities
 * - Removes potentially dangerous patterns
 * - Preserves newlines and basic formatting
 * 
 * @param content - Raw review content
 * @returns Sanitized content safe for display
 */
export function sanitizeReviewContent(content: string | null | undefined): string {
  if (!content) return '';
  
  let sanitized = content;
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');
  
  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Escape remaining HTML entities
  sanitized = escapeHtml(sanitized);
  
  // Trim excessive whitespace while preserving paragraph breaks
  sanitized = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return sanitized;
}

/**
 * Sanitize author name for display
 * More restrictive than review content
 */
export function sanitizeAuthorName(name: string | null | undefined): string {
  if (!name) return '';
  
  // Only allow basic characters for names
  let sanitized = name
    .replace(/[<>&"'`=/]/g, '') // Remove dangerous chars
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
  
  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Sanitize a URL for safe linking
 * Only allows http, https protocols
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow safe protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.href;
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize an entire review object for API response
 */
export function sanitizeReview<T extends {
  content?: string | null;
  title?: string | null;
  authorName?: string | null;
  responseText?: string | null;
  externalUrl?: string | null;
}>(review: T): T {
  return {
    ...review,
    content: review.content ? sanitizeReviewContent(review.content) : review.content,
    title: review.title ? escapeHtml(review.title) : review.title,
    authorName: review.authorName ? sanitizeAuthorName(review.authorName) : review.authorName,
    responseText: review.responseText ? sanitizeReviewContent(review.responseText) : review.responseText,
    externalUrl: review.externalUrl ? sanitizeUrl(review.externalUrl) : review.externalUrl,
  };
}

/**
 * Sanitize an array of reviews
 */
export function sanitizeReviews<T extends {
  content?: string | null;
  title?: string | null;
  authorName?: string | null;
  responseText?: string | null;
  externalUrl?: string | null;
}>(reviews: T[]): T[] {
  return reviews.map(sanitizeReview);
}

/**
 * Sanitize JSON metadata that might contain user content
 * Recursively sanitizes string values
 */
export function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }
  
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[escapeHtml(key)] = sanitizeMetadata(value);
    }
    return result;
  }
  
  return data;
}

/**
 * Strip all HTML tags from text
 */
export function stripHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Truncate text to a maximum length with ellipsis
 * Ensures we don't cut in the middle of an HTML entity
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  // Find a safe cut point (don't cut in middle of an entity like &amp;)
  let cutPoint = maxLength - 3; // Leave room for ellipsis
  while (cutPoint > 0 && text[cutPoint] !== ' ') {
    cutPoint--;
  }
  
  if (cutPoint === 0) {
    cutPoint = maxLength - 3;
  }
  
  return text.substring(0, cutPoint) + '...';
}

export default {
  escapeHtml,
  sanitizeReviewContent,
  sanitizeAuthorName,
  sanitizeUrl,
  sanitizeReview,
  sanitizeReviews,
  sanitizeMetadata,
  stripHtml,
  truncate,
};
