/**
 * Rate Limiting
 * 
 * In-memory rate limiting for sensitive endpoints.
 * For production at scale, consider Redis-backed rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const rateLimitLogger = loggers.api.child({ service: 'rate-limit' });

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key generator (defaults to IP) */
  keyGenerator?: (req: NextRequest) => string;
  /** Custom error message */
  message?: string;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limits
 * Map of endpoint -> Map of key -> entry
 */
const rateLimitStore = new Map<string, Map<string, RateLimitEntry>>();

/**
 * Clean up expired entries periodically
 */
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [endpoint, entries] of rateLimitStore) {
    for (const [key, entry] of entries) {
      if (entry.resetTime < now) {
        entries.delete(key);
      }
    }
    if (entries.size === 0) {
      rateLimitStore.delete(endpoint);
    }
  }
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Get client identifier from request
 */
function getClientKey(req: NextRequest): string {
  // Try various headers for the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a hash of headers for identification
  const userAgent = req.headers.get('user-agent') || '';
  const acceptLanguage = req.headers.get('accept-language') || '';
  return `unknown-${hashString(userAgent + acceptLanguage)}`;
}

/**
 * Simple string hash for fallback identification
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const RateLimiters = {
  /**
   * Strict rate limit for authentication endpoints
   * 5 requests per minute per IP
   */
  auth: {
    maxRequests: 5,
    windowMs: 60_000,
    message: 'Too many authentication attempts. Please try again in a minute.',
  } satisfies RateLimitConfig,

  /**
   * Rate limit for login specifically
   * 10 requests per 15 minutes per IP
   */
  login: {
    maxRequests: 10,
    windowMs: 15 * 60_000,
    message: 'Too many login attempts. Please try again later.',
  } satisfies RateLimitConfig,

  /**
   * Rate limit for data exports
   * 10 exports per hour per user
   */
  export: {
    maxRequests: 10,
    windowMs: 60 * 60_000,
    message: 'Export rate limit exceeded. Please try again later.',
  } satisfies RateLimitConfig,

  /**
   * Rate limit for job triggers (score runs, etc.)
   * 20 triggers per hour per user
   */
  jobTrigger: {
    maxRequests: 20,
    windowMs: 60 * 60_000,
    message: 'Too many job triggers. Please wait before triggering more.',
  } satisfies RateLimitConfig,

  /**
   * Rate limit for password reset requests
   * 3 per hour per IP
   */
  passwordReset: {
    maxRequests: 3,
    windowMs: 60 * 60_000,
    message: 'Too many password reset requests. Please try again later.',
  } satisfies RateLimitConfig,

  /**
   * General API rate limit
   * 100 requests per minute per IP
   */
  api: {
    maxRequests: 100,
    windowMs: 60_000,
    message: 'Rate limit exceeded. Please slow down.',
  } satisfies RateLimitConfig,
};

/**
 * Check rate limit and return result
 */
export function checkRateLimit(
  endpoint: string,
  clientKey: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  
  // Get or create endpoint store
  if (!rateLimitStore.has(endpoint)) {
    rateLimitStore.set(endpoint, new Map());
  }
  const endpointStore = rateLimitStore.get(endpoint)!;
  
  // Get or create entry for this client
  let entry = endpointStore.get(clientKey);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    endpointStore.set(clientKey, entry);
  }
  
  entry.count++;
  
  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit middleware wrapper for API routes
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request, 'login', RateLimiters.login);
 *   if (rateLimitResult) return rateLimitResult;
 *   
 *   // ... rest of handler
 * }
 */
export function rateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig
): NextResponse | null {
  const keyGenerator = config.keyGenerator || getClientKey;
  const clientKey = keyGenerator(request);
  
  const result = checkRateLimit(endpoint, clientKey, config);
  
  if (!result.allowed) {
    rateLimitLogger.warn({
      endpoint,
      clientKey: clientKey.substring(0, 20) + '...',
      resetTime: new Date(result.resetTime).toISOString(),
    }, 'Rate limit exceeded');
    
    return NextResponse.json(
      { 
        error: config.message || 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        },
      }
    );
  }
  
  return null; // Not rate limited
}

/**
 * Create a rate limiter with user ID as the key
 * Use for authenticated endpoints where per-user limiting is needed
 */
export function rateLimitByUser(
  request: NextRequest,
  endpoint: string,
  userId: string,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(endpoint, `user:${userId}`, config);
  
  if (!result.allowed) {
    rateLimitLogger.warn({
      endpoint,
      userId,
      resetTime: new Date(result.resetTime).toISOString(),
    }, 'User rate limit exceeded');
    
    return NextResponse.json(
      { 
        error: config.message || 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        },
      }
    );
  }
  
  return null;
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  endpoint: string,
  clientKey: string,
  config: RateLimitConfig
): { count: number; remaining: number; resetTime: number } {
  const now = Date.now();
  const endpointStore = rateLimitStore.get(endpoint);
  
  if (!endpointStore) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
  
  const entry = endpointStore.get(clientKey);
  
  if (!entry || entry.resetTime < now) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

export default {
  rateLimit,
  rateLimitByUser,
  checkRateLimit,
  getRateLimitStatus,
  RateLimiters,
};
