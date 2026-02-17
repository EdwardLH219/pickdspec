/**
 * Spam Detection Service for Till Slip Feedback
 * 
 * Provides heuristic-based spam scoring for public submissions.
 * Factors considered:
 * - Text length and quality
 * - Rating patterns (extreme ratings with no detail)
 * - Repeated submissions from same device/IP
 * - Suspicious timing patterns
 */

import { db } from '@/server/db';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface SpamCheckInput {
  overallRating: number;
  positiveThemes: string[];
  negativeThemes: string[];
  positiveDetail?: string;
  negativeDetail?: string;
  anythingElse?: string;
  ipHash?: string;
  userAgentHash?: string;
  deviceFingerprint?: string;
  tenantId: string;
}

export interface SpamCheckResult {
  score: number; // 0-1, higher = more likely spam
  flagged: boolean;
  reasons: string[];
  details: Record<string, number>;
}

export interface SpamConfig {
  /** Threshold above which submissions are flagged (0-1) */
  flagThreshold: number;
  /** Whether to exclude flagged submissions from scoring pipeline */
  excludeFlaggedFromScoring: boolean;
  /** Whether captcha is required */
  captchaEnabled: boolean;
  /** Captcha provider ('hcaptcha' | 'turnstile') */
  captchaProvider: 'hcaptcha' | 'turnstile' | null;
}

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

export const DEFAULT_SPAM_CONFIG: SpamConfig = {
  flagThreshold: 0.6,
  excludeFlaggedFromScoring: true,
  captchaEnabled: false,
  captchaProvider: null,
};

// ============================================================
// SPAM SCORING WEIGHTS
// ============================================================

const WEIGHTS = {
  // Text quality
  noTextAtAll: 0.3,
  veryShortText: 0.15,
  shortText: 0.05,
  
  // Rating patterns
  extremeRatingNoDetail: 0.25,
  extremeRatingLowDetail: 0.1,
  
  // Theme selection
  noThemesSelected: 0.1,
  tooManyThemes: 0.05,
  
  // Repetition
  recentSameIP: 0.2,
  recentSameDevice: 0.3,
  
  // Suspicious patterns
  allCapsText: 0.1,
  repetitiveText: 0.15,
  suspiciousCharacters: 0.1,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate total text length from all feedback fields
 */
function getTotalTextLength(input: SpamCheckInput): number {
  return (
    (input.positiveDetail?.length || 0) +
    (input.negativeDetail?.length || 0) +
    (input.anythingElse?.length || 0)
  );
}

/**
 * Check if text is mostly uppercase
 */
function isAllCaps(text: string): boolean {
  if (!text || text.length < 10) return false;
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 5) return false;
  const uppercase = letters.replace(/[^A-Z]/g, '');
  return uppercase.length / letters.length > 0.8;
}

/**
 * Check for repetitive patterns in text
 */
function hasRepetitivePatterns(text: string): boolean {
  if (!text || text.length < 20) return false;
  
  // Check for repeated words
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    if (word.length > 2) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  
  // If any word appears more than 3 times in short text, suspicious
  for (const count of wordCounts.values()) {
    if (count > 3 && words.length < 30) return true;
  }
  
  // Check for repeated character sequences
  const repeatedChars = /(.)\1{4,}/; // 5+ same characters in a row
  if (repeatedChars.test(text)) return true;
  
  return false;
}

/**
 * Check for suspicious characters (spam markers)
 */
function hasSuspiciousCharacters(text: string): boolean {
  if (!text) return false;
  
  // Multiple URLs
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 1) return true;
  
  // Excessive special characters
  const specialRatio = text.replace(/[a-zA-Z0-9\s]/g, '').length / text.length;
  if (specialRatio > 0.3) return true;
  
  // Phone numbers or emails in feedback (potential spam/advertising)
  const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  const hasEmail = /\S+@\S+\.\S+/.test(text);
  if (hasPhone || hasEmail) return true;
  
  return false;
}

// ============================================================
// MAIN SPAM DETECTION
// ============================================================

/**
 * Calculate spam score for a submission
 */
export async function calculateSpamScore(input: SpamCheckInput): Promise<SpamCheckResult> {
  const reasons: string[] = [];
  const details: Record<string, number> = {};
  let totalScore = 0;

  const totalTextLength = getTotalTextLength(input);
  const allText = [input.positiveDetail, input.negativeDetail, input.anythingElse]
    .filter(Boolean)
    .join(' ');

  // ============================================================
  // TEXT QUALITY CHECKS
  // ============================================================

  // No text at all
  if (totalTextLength === 0) {
    const score = WEIGHTS.noTextAtAll;
    totalScore += score;
    details['no_text'] = score;
    reasons.push('No text feedback provided');
  } 
  // Very short text (< 10 chars)
  else if (totalTextLength < 10) {
    const score = WEIGHTS.veryShortText;
    totalScore += score;
    details['very_short_text'] = score;
    reasons.push('Very short text feedback');
  }
  // Short text (< 30 chars)
  else if (totalTextLength < 30) {
    const score = WEIGHTS.shortText;
    totalScore += score;
    details['short_text'] = score;
    reasons.push('Short text feedback');
  }

  // ============================================================
  // RATING PATTERN CHECKS
  // ============================================================

  const isExtremeRating = input.overallRating === 1 || input.overallRating === 5;
  
  if (isExtremeRating && totalTextLength === 0) {
    const score = WEIGHTS.extremeRatingNoDetail;
    totalScore += score;
    details['extreme_rating_no_detail'] = score;
    reasons.push('Extreme rating with no explanation');
  } else if (isExtremeRating && totalTextLength < 20) {
    const score = WEIGHTS.extremeRatingLowDetail;
    totalScore += score;
    details['extreme_rating_low_detail'] = score;
    reasons.push('Extreme rating with minimal explanation');
  }

  // ============================================================
  // THEME SELECTION CHECKS
  // ============================================================

  const totalThemes = input.positiveThemes.length + input.negativeThemes.length;
  
  if (totalThemes === 0) {
    const score = WEIGHTS.noThemesSelected;
    totalScore += score;
    details['no_themes'] = score;
    reasons.push('No feedback themes selected');
  } else if (totalThemes > 8) {
    const score = WEIGHTS.tooManyThemes;
    totalScore += score;
    details['too_many_themes'] = score;
    reasons.push('Unusually many themes selected');
  }

  // ============================================================
  // TEXT PATTERN CHECKS
  // ============================================================

  if (allText && isAllCaps(allText)) {
    const score = WEIGHTS.allCapsText;
    totalScore += score;
    details['all_caps'] = score;
    reasons.push('Text is mostly uppercase');
  }

  if (allText && hasRepetitivePatterns(allText)) {
    const score = WEIGHTS.repetitiveText;
    totalScore += score;
    details['repetitive'] = score;
    reasons.push('Text contains repetitive patterns');
  }

  if (allText && hasSuspiciousCharacters(allText)) {
    const score = WEIGHTS.suspiciousCharacters;
    totalScore += score;
    details['suspicious_chars'] = score;
    reasons.push('Text contains suspicious content');
  }

  // ============================================================
  // REPETITION CHECKS (Database lookups)
  // ============================================================

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check for recent submissions from same IP
  if (input.ipHash) {
    const recentFromIP = await db.tillReviewSubmission.count({
      where: {
        tenantId: input.tenantId,
        ipHash: input.ipHash,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentFromIP >= 2) {
      const score = WEIGHTS.recentSameIP;
      totalScore += score;
      details['repeated_ip'] = score;
      reasons.push(`${recentFromIP} submissions from same IP in last hour`);
    }
  }

  // Check for recent submissions from same device fingerprint
  if (input.deviceFingerprint) {
    const recentFromDevice = await db.tillReviewSubmission.count({
      where: {
        tenantId: input.tenantId,
        deviceFingerprint: input.deviceFingerprint,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentFromDevice >= 3) {
      const score = WEIGHTS.recentSameDevice;
      totalScore += score;
      details['repeated_device'] = score;
      reasons.push(`${recentFromDevice} submissions from same device in 24 hours`);
    }
  }

  // ============================================================
  // CALCULATE FINAL SCORE
  // ============================================================

  // Cap at 1.0
  const finalScore = Math.min(1.0, totalScore);
  
  // Determine if flagged
  const flagged = finalScore >= DEFAULT_SPAM_CONFIG.flagThreshold;

  return {
    score: finalScore,
    flagged,
    reasons,
    details,
  };
}

// ============================================================
// RATE LIMITING
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (for single instance)
// In production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
const RATE_LIMITS = {
  // Per IP: 10 requests per 15 minutes
  ip: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  // Per token: 3 requests per hour (prevents token reuse attempts)
  token: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  // Global per tenant: 100 requests per hour (DoS protection)
  tenant: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
};

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  type: 'ip' | 'token' | 'tenant',
  key: string
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[type];
  const storeKey = `${type}:${key}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(storeKey);
  
  // Create new entry or reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  const allowed = entry.count < config.maxRequests;
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(storeKey, entry);
  
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: Math.max(0, entry.resetAt - now),
  };
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

// ============================================================
// CAPTCHA VERIFICATION
// ============================================================

/**
 * Verify hCaptcha token
 */
export async function verifyHCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('hCaptcha secret not configured');
    return true; // Allow if not configured
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `response=${token}&secret=${secret}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('hCaptcha verification failed:', error);
    return false;
  }
}

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('Turnstile secret not configured');
    return true; // Allow if not configured
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}

/**
 * Verify captcha token based on provider
 */
export async function verifyCaptcha(
  token: string,
  provider: 'hcaptcha' | 'turnstile'
): Promise<boolean> {
  if (provider === 'hcaptcha') {
    return verifyHCaptcha(token);
  } else if (provider === 'turnstile') {
    return verifyTurnstile(token);
  }
  return true;
}

// ============================================================
// HASH UTILITIES
// ============================================================

/**
 * Hash IP address for privacy-preserving storage
 */
export function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || 'pickd-ip-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Hash user agent for privacy-preserving storage
 */
export function hashUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const salt = process.env.UA_HASH_SALT || 'pickd-ua-salt';
  return crypto.createHash('sha256').update(`${salt}:${ua}`).digest('hex').slice(0, 32);
}

/**
 * Generate device fingerprint hash from request headers
 */
export function generateDeviceFingerprint(headers: Headers): string | null {
  const components = [
    headers.get('user-agent'),
    headers.get('accept-language'),
    headers.get('accept-encoding'),
    headers.get('sec-ch-ua'),
    headers.get('sec-ch-ua-platform'),
  ].filter(Boolean);

  if (components.length === 0) return null;

  const salt = process.env.FINGERPRINT_SALT || 'pickd-fp-salt';
  return crypto.createHash('sha256').update(`${salt}:${components.join('|')}`).digest('hex').slice(0, 32);
}
