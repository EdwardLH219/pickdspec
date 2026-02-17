/**
 * API Route: Public Feedback Submission
 * 
 * No authentication required - this is the public endpoint
 * accessed via QR code on receipts.
 * 
 * Security features:
 * - Rate limiting by IP, token, and tenant
 * - Spam detection with heuristic scoring
 * - Optional captcha verification
 * - Privacy-preserving PII hashing
 * 
 * GET: Validate token and return settings
 * POST: Submit feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyReceiptToken, markTokenAsSubmitted, hashToken } from '@/server/till-slip';
import {
  calculateSpamScore,
  checkRateLimit,
  hashIP,
  hashUserAgent,
  generateDeviceFingerprint,
  verifyCaptcha,
  DEFAULT_SPAM_CONFIG,
} from '@/server/till-slip/spam-detection';
import {
  sanitizeText,
  sanitizeThemes,
  sanitizeRating,
  isValidEmail,
} from '@/server/till-slip/security';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

interface FeedbackSubmission {
  overallRating: number;
  positiveThemes: string[];
  negativeThemes: string[];
  positiveDetail?: string;
  negativeDetail?: string;
  anythingElse?: string;
  consentGiven: boolean;
  contactOptIn?: boolean;
  contactEmail?: string;
  receiptRef?: string;
  captchaToken?: string;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate a discount code for the customer
 * Format: PREFIX-XXXX-XXXX (e.g., FB-A3K9-M2X4)
 */
function generateDiscountCode(prefix: string): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}`;
}

/**
 * Generate a short, human-friendly redemption code
 * Format: 6 alphanumeric characters, uppercase, no ambiguous chars (0/O, 1/I/L)
 * Derived from receipt token hash for uniqueness
 */
function generateRedemptionCode(receiptId: string, salt: string): string {
  // Use HMAC to derive code from receipt ID with a secret salt
  const hmac = crypto.createHmac('sha256', process.env.RECEIPT_TOKEN_SECRET || salt);
  hmac.update(receiptId);
  const hash = hmac.digest('hex');
  
  // Convert to human-friendly characters (no 0/O, 1/I/L)
  const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    // Use 2 hex chars per code char for better distribution
    const val = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    code += CHARSET[val % CHARSET.length];
  }
  return code;
}

/**
 * Build review content from structured feedback with clear separators
 * Format: [RATING] | [POSITIVES] | [NEGATIVES] | [ADDITIONAL]
 */
function buildReviewContent(submission: FeedbackSubmission): string {
  const sections: string[] = [];
  
  // Section 1: Positive themes and details
  if (submission.positiveThemes.length > 0 || submission.positiveDetail) {
    const positiveSection: string[] = [];
    if (submission.positiveThemes.length > 0) {
      positiveSection.push(`What was great: ${submission.positiveThemes.join(', ')}.`);
    }
    if (submission.positiveDetail) {
      positiveSection.push(submission.positiveDetail);
    }
    sections.push(positiveSection.join(' '));
  }
  
  // Section 2: Negative themes and details
  if (submission.negativeThemes.length > 0 || submission.negativeDetail) {
    const negativeSection: string[] = [];
    if (submission.negativeThemes.length > 0) {
      negativeSection.push(`Could improve: ${submission.negativeThemes.join(', ')}.`);
    }
    if (submission.negativeDetail) {
      negativeSection.push(submission.negativeDetail);
    }
    sections.push(negativeSection.join(' '));
  }
  
  // Section 3: Additional comments
  if (submission.anythingElse) {
    sections.push(`Additional: ${submission.anythingElse}`);
  }
  
  // Join with clear separator
  return sections.length > 0 
    ? sections.join(' --- ')
    : 'Feedback submitted via receipt QR code.';
}

/**
 * Map chip names to system theme names
 * These map to the themes created in seed.ts
 */
const CHIP_TO_THEME_MAP: Record<string, string> = {
  'Service': 'Service',
  'Food Quality': 'Food Quality',
  'Drinks': 'Drinks',
  'Ambiance': 'Ambiance',
  'Music': 'Ambiance', // Map to Ambiance
  'Wait Time': 'Wait Time',
  'Value': 'Value',
  'Cleanliness': 'Cleanliness',
  'Menu Variety': 'Food Quality', // Map to Food Quality
  'Portion Size': 'Food Quality', // Map to Food Quality
};

/**
 * Create ReviewTheme records for selected chips
 * Maps directly selected themes with high confidence (0.95)
 */
async function createThemeAssociations(
  reviewId: string,
  positiveThemes: string[],
  negativeThemes: string[],
  tenantId: string
): Promise<void> {
  // Get all system themes
  const themes = await db.theme.findMany({
    where: {
      OR: [
        { isSystem: true },
        { organizationId: null },
      ],
      isActive: true,
    },
    select: { id: true, name: true },
  });

  const themeNameToId = new Map(themes.map(t => [t.name.toLowerCase(), t.id]));
  const reviewThemesToCreate: Array<{
    reviewId: string;
    themeId: string;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidenceScore: number;
    keywords: string[];
  }> = [];

  // Process positive themes
  for (const chipName of positiveThemes) {
    const themeName = CHIP_TO_THEME_MAP[chipName] || chipName;
    const themeId = themeNameToId.get(themeName.toLowerCase());
    
    if (themeId) {
      reviewThemesToCreate.push({
        reviewId,
        themeId,
        sentiment: 'POSITIVE',
        confidenceScore: 0.95, // High confidence - directly selected by user
        keywords: [chipName],
      });
    }
  }

  // Process negative themes
  for (const chipName of negativeThemes) {
    const themeName = CHIP_TO_THEME_MAP[chipName] || chipName;
    const themeId = themeNameToId.get(themeName.toLowerCase());
    
    if (themeId) {
      // Check if we already added this theme as positive (shouldn't happen due to UI logic, but defensive)
      const existingIndex = reviewThemesToCreate.findIndex(
        rt => rt.themeId === themeId
      );
      
      if (existingIndex === -1) {
        reviewThemesToCreate.push({
          reviewId,
          themeId,
          sentiment: 'NEGATIVE',
          confidenceScore: 0.95, // High confidence - directly selected by user
          keywords: [chipName],
        });
      }
    }
  }

  // Batch create all theme associations
  if (reviewThemesToCreate.length > 0) {
    await db.reviewTheme.createMany({
      data: reviewThemesToCreate,
    });
  }
}

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') ||
         null;
}

// Default theme options
const DEFAULT_THEMES = [
  'Service',
  'Food Quality',
  'Drinks',
  'Ambiance',
  'Music',
  'Wait Time',
  'Value',
  'Cleanliness',
  'Menu Variety',
  'Portion Size',
];

/**
 * Check if a token looks like a shortCode (format: xxx-xxxx)
 * ShortCodes are 7-10 chars with a hyphen in the middle
 */
function isShortCode(token: string): boolean {
  return /^[a-z]{2,4}-[a-z0-9]{4,6}$/i.test(token);
}

/**
 * Load settings by shortCode (for static branch QR)
 */
async function getSettingsByShortCode(shortCode: string) {
  const settings = await db.tillReviewSettings.findFirst({
    where: { shortCode },
    include: {
      tenant: {
        select: { id: true, name: true },
      },
    },
  });
  return settings;
}

// ============================================================
// GET - Validate Token
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Rate limit by token
    const tokenLimit = checkRateLimit('token', token);
    if (!tokenLimit.allowed) {
      return NextResponse.json({
        valid: false,
        error: 'RATE_LIMITED',
        errorMessage: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(tokenLimit.resetIn / 1000),
      }, {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(tokenLimit.resetIn / 1000)),
        },
      });
    }

    // Check if this is a shortCode (static branch QR) vs receipt token
    if (isShortCode(token)) {
      // Handle shortCode - static branch QR without specific receipt
      const settings = await getSettingsByShortCode(token);
      
      if (!settings) {
        return NextResponse.json({
          valid: false,
          error: 'INVALID_CODE',
          errorMessage: 'This feedback link is invalid.',
        });
      }

      if (!settings.isActive) {
        return NextResponse.json({
          valid: false,
          error: 'CHANNEL_INACTIVE',
          errorMessage: 'Feedback collection is currently unavailable.',
        });
      }

      // Get theme options
      const themeOptions = settings.themeOptions || DEFAULT_THEMES;
      const captchaEnabled = process.env.CAPTCHA_ENABLED === 'true';
      const captchaProvider = process.env.CAPTCHA_PROVIDER as 'hcaptcha' | 'turnstile' | undefined;
      const captchaSiteKey = captchaProvider === 'hcaptcha' 
        ? process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
        : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

      return NextResponse.json({
        valid: true,
        isShortCode: true, // Flag to indicate this is a shortCode flow
        tenantId: settings.tenantId,
        tenantName: settings.tenant.name,
        settings: {
          incentiveType: settings.incentiveType,
          incentiveTitle: settings.incentiveTitle,
          incentiveDescription: settings.incentiveDescription,
          discountPercent: settings.discountPercent,
          discountTerms: settings.discountTerms,
          prizeDrawTitle: settings.prizeDrawTitle,
          prizeDrawDescription: settings.prizeDrawDescription,
          prizeDrawTerms: settings.prizeDrawTerms,
          headerColor: settings.headerColor || '#1e40af',
          accentColor: settings.accentColor || '#3b82f6',
          requireReceiptNumber: settings.requireReceiptNumber,
          redirectToGoogleReview: settings.redirectToGoogleReview,
          googleReviewUrl: settings.googleReviewUrl,
          themeOptions,
          captchaEnabled,
          captchaProvider,
          captchaSiteKey,
        },
        receipt: null, // No specific receipt for shortCode flow
      });
    }

    // Standard receipt token flow
    const result = await verifyReceiptToken(token);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error,
        errorMessage: getErrorMessage(result.error),
      });
    }

    // Get theme options (use settings or defaults)
    const themeOptions = result.settings?.themeOptions || DEFAULT_THEMES;

    // Check if captcha is required (from tenant settings or env)
    const captchaEnabled = process.env.CAPTCHA_ENABLED === 'true';
    const captchaProvider = process.env.CAPTCHA_PROVIDER as 'hcaptcha' | 'turnstile' | undefined;
    const captchaSiteKey = captchaProvider === 'hcaptcha' 
      ? process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
      : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    return NextResponse.json({
      valid: true,
      tenantName: result.tenantName,
      settings: {
        incentiveType: result.settings?.incentiveType,
        incentiveTitle: result.settings?.incentiveTitle,
        incentiveDescription: result.settings?.incentiveDescription,
        discountPercent: result.settings?.discountPercent,
        discountTerms: result.settings?.discountTerms,
        prizeDrawTitle: result.settings?.prizeDrawTitle,
        prizeDrawDescription: result.settings?.prizeDrawDescription,
        prizeDrawTerms: result.settings?.prizeDrawTerms,
        headerColor: result.settings?.headerColor || '#1e40af',
        accentColor: result.settings?.accentColor || '#3b82f6',
        requireReceiptNumber: result.settings?.requireReceiptNumber,
        redirectToGoogleReview: result.settings?.redirectToGoogleReview,
        googleReviewUrl: result.settings?.googleReviewUrl,
        themeOptions,
        captchaEnabled,
        captchaProvider,
        captchaSiteKey,
      },
      receipt: {
        id: result.receipt?.id,
        receiptLastFour: result.receipt?.receiptRef?.slice(-4) || null,
      },
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { valid: false, error: 'INTERNAL_ERROR', errorMessage: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - Submit Feedback
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent');
    const ipHash = hashIP(clientIP);
    const uaHash = hashUserAgent(userAgent);
    const deviceFingerprint = generateDeviceFingerprint(request.headers);

    // ============================================================
    // RATE LIMITING
    // ============================================================

    // Check IP rate limit
    if (ipHash) {
      const ipLimit = checkRateLimit('ip', ipHash);
      if (!ipLimit.allowed) {
        return NextResponse.json({
          success: false,
          error: 'RATE_LIMITED',
          errorMessage: 'Too many requests from your network. Please try again later.',
          retryAfter: Math.ceil(ipLimit.resetIn / 1000),
        }, {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(ipLimit.resetIn / 1000)),
          },
        });
      }
    }

    // Check token rate limit
    const tokenLimit = checkRateLimit('token', token);
    if (!tokenLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMITED',
        errorMessage: 'Too many submission attempts. Please try again later.',
        retryAfter: Math.ceil(tokenLimit.resetIn / 1000),
      }, {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(tokenLimit.resetIn / 1000)),
        },
      });
    }

    // ============================================================
    // TOKEN VERIFICATION
    // ============================================================

    let tenantId: string;
    let receiptId: string | null = null;
    let settings: {
      incentiveType: string;
      discountPercent: number | null;
      tokenExpiryDays: number;
      themeOptions?: string[];
    } | null = null;
    let isShortCodeFlow = false;

    // Check if this is a shortCode (static branch QR) vs receipt token
    if (isShortCode(token)) {
      isShortCodeFlow = true;
      
      // Load settings by shortCode
      const shortCodeSettings = await getSettingsByShortCode(token);
      
      if (!shortCodeSettings) {
        return NextResponse.json({
          success: false,
          error: 'INVALID_CODE',
          errorMessage: 'This feedback link is invalid.',
        }, { status: 400 });
      }

      if (!shortCodeSettings.isActive) {
        return NextResponse.json({
          success: false,
          error: 'CHANNEL_INACTIVE',
          errorMessage: 'Feedback collection is currently unavailable.',
        }, { status: 400 });
      }

      tenantId = shortCodeSettings.tenantId;
      settings = {
        incentiveType: shortCodeSettings.incentiveType,
        discountPercent: shortCodeSettings.discountPercent,
        tokenExpiryDays: shortCodeSettings.tokenExpiryDays,
        themeOptions: shortCodeSettings.themeOptions as string[] | undefined,
      };
    } else {
      // Standard receipt token flow
      const tokenResult = await verifyReceiptToken(token);

      if (!tokenResult.valid) {
        return NextResponse.json({
          success: false,
          error: tokenResult.error,
          errorMessage: getErrorMessage(tokenResult.error),
        }, { status: 400 });
      }

      tenantId = tokenResult.receipt!.tenantId;
      receiptId = tokenResult.receipt!.id;
      settings = tokenResult.settings ? {
        incentiveType: tokenResult.settings.incentiveType,
        discountPercent: tokenResult.settings.discountPercent,
        tokenExpiryDays: tokenResult.settings.tokenExpiryDays,
        themeOptions: tokenResult.settings.themeOptions as string[] | undefined,
      } : null;
    }

    // Check tenant rate limit
    const tenantLimit = checkRateLimit('tenant', tenantId);
    if (!tenantLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMITED',
        errorMessage: 'This feedback system is temporarily busy. Please try again later.',
        retryAfter: Math.ceil(tenantLimit.resetIn / 1000),
      }, {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(tenantLimit.resetIn / 1000)),
        },
      });
    }

    // ============================================================
    // PARSE & VALIDATE SUBMISSION
    // ============================================================

    const rawBody: FeedbackSubmission = await request.json();

    // Sanitize and validate rating
    const rating = sanitizeRating(rawBody.overallRating);
    if (rating === null) {
      return NextResponse.json({
        success: false,
        error: 'INVALID_RATING',
        errorMessage: 'Please select a rating between 1 and 5 stars.',
      }, { status: 400 });
    }

    // Get allowed theme options
    const allowedThemes = settings?.themeOptions || DEFAULT_THEMES;

    // Sanitize all input fields (XSS prevention)
    const body: FeedbackSubmission = {
      overallRating: rating,
      positiveThemes: sanitizeThemes(rawBody.positiveThemes, allowedThemes),
      negativeThemes: sanitizeThemes(rawBody.negativeThemes, allowedThemes),
      positiveDetail: sanitizeText(rawBody.positiveDetail, { maxLength: 2000 }),
      negativeDetail: sanitizeText(rawBody.negativeDetail, { maxLength: 2000 }),
      anythingElse: sanitizeText(rawBody.anythingElse, { maxLength: 2000 }),
      consentGiven: Boolean(rawBody.consentGiven),
      contactOptIn: Boolean(rawBody.contactOptIn),
      contactEmail: rawBody.contactOptIn && isValidEmail(rawBody.contactEmail) 
        ? rawBody.contactEmail?.trim().toLowerCase() 
        : undefined,
      captchaToken: rawBody.captchaToken,
    };

    // ============================================================
    // CAPTCHA VERIFICATION
    // ============================================================

    const captchaEnabled = process.env.CAPTCHA_ENABLED === 'true';
    const captchaProvider = process.env.CAPTCHA_PROVIDER as 'hcaptcha' | 'turnstile' | undefined;

    if (captchaEnabled && captchaProvider) {
      if (!body.captchaToken) {
        return NextResponse.json({
          success: false,
          error: 'CAPTCHA_REQUIRED',
          errorMessage: 'Please complete the captcha verification.',
        }, { status: 400 });
      }

      const captchaValid = await verifyCaptcha(body.captchaToken, captchaProvider);
      if (!captchaValid) {
        return NextResponse.json({
          success: false,
          error: 'CAPTCHA_FAILED',
          errorMessage: 'Captcha verification failed. Please try again.',
        }, { status: 400 });
      }
    }

    // ============================================================
    // SPAM DETECTION
    // ============================================================

    const spamResult = await calculateSpamScore({
      overallRating: body.overallRating,
      positiveThemes: body.positiveThemes || [],
      negativeThemes: body.negativeThemes || [],
      positiveDetail: body.positiveDetail,
      negativeDetail: body.negativeDetail,
      anythingElse: body.anythingElse,
      ipHash: ipHash || undefined,
      userAgentHash: uaHash || undefined,
      deviceFingerprint: deviceFingerprint || undefined,
      tenantId: tenantId,
    });

    console.log(`[Spam Detection] Token ${token.slice(0, 8)}... Score: ${spamResult.score.toFixed(2)}, Flagged: ${spamResult.flagged}`, {
      reasons: spamResult.reasons,
    });

    // ============================================================
    // CREATE SUBMISSION
    // ============================================================

    // For shortCode flow without a receipt, create an anonymous receipt first
    let actualReceiptId = receiptId;
    let settingsId: string | null = null;
    
    if (isShortCodeFlow && !actualReceiptId) {
      // First, get the settings ID for this shortCode
      const shortCodeSettings = await db.tillReviewSettings.findFirst({
        where: { shortCode: token },
        select: { id: true },
      });
      
      if (!shortCodeSettings) {
        return NextResponse.json({
          success: false,
          error: 'INVALID_CODE',
          errorMessage: 'This feedback link is invalid.',
        }, { status: 400 });
      }
      
      settingsId = shortCodeSettings.id;
      
      // Create an anonymous receipt for this submission
      const anonToken = `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const anonymousReceipt = await db.tillReceipt.create({
        data: {
          tenant: { connect: { id: tenantId } },
          settings: { connect: { id: settingsId } },
          token: anonToken,
          tokenHash: hashToken(anonToken),
          status: 'SUBMITTED', // Mark as submitted immediately since it's anonymous
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          receiptRef: `QR-${Date.now().toString(36).toUpperCase()}`,
          issuedAt: new Date(),
        },
      });
      actualReceiptId = anonymousReceipt.id;
    }

    // Generate incentive code if applicable
    let incentiveCode: string | null = null;
    let incentiveCodeExpiry: Date | null = null;
    let redemptionCode: string | null = null;

    if (settings?.incentiveType === 'DISCOUNT') {
      incentiveCode = generateDiscountCode('FB');
      incentiveCodeExpiry = new Date();
      incentiveCodeExpiry.setDate(incentiveCodeExpiry.getDate() + 30);
      // Generate short redemption code for staff verification
      if (actualReceiptId) {
        redemptionCode = generateRedemptionCode(actualReceiptId, tenantId);
      }
    } else if (settings?.incentiveType === 'PRIZE_DRAW') {
      incentiveCode = generateDiscountCode('PD');
    }

    // Create the submission
    const submission = await db.tillReviewSubmission.create({
      data: {
        tenantId,
        receiptId: actualReceiptId!,
        overallRating: body.overallRating,
        positiveThemes: body.positiveThemes || [],
        negativeThemes: body.negativeThemes || [],
        positiveDetail: body.positiveDetail || null,
        negativeDetail: body.negativeDetail || null,
        anythingElse: body.anythingElse || null,
        consentGiven: body.consentGiven || false,
        contactOptIn: body.contactOptIn || false,
        contactEmail: body.contactOptIn ? body.contactEmail : null,
        ipHash,
        userAgentHash: uaHash,
        deviceFingerprint,
        spamScore: spamResult.score,
        isFlagged: spamResult.flagged,
        incentiveCode,
        incentiveCodeExpiry,
        incentiveRedeemed: false,
        redemptionCode,
      },
    });

    // Mark the token as submitted (prevents replay) - only for receipt token flow
    if (!isShortCodeFlow && receiptId) {
      await markTokenAsSubmitted(receiptId);
    }

    // ============================================================
    // CREATE REVIEW RECORD
    // ============================================================

    // Only create review if not flagged OR if config allows flagged reviews
    const shouldCreateReview = !spamResult.flagged || !DEFAULT_SPAM_CONFIG.excludeFlaggedFromScoring;

    if (shouldCreateReview) {
      const reviewContent = buildReviewContent(body);
      
      const review = await db.review.create({
        data: {
          tenantId,
          connectorId: null,
          externalReviewId: null,
          tillReviewSubmissionId: submission.id,
          rating: body.overallRating,
          title: null,
          content: reviewContent,
          authorName: isShortCodeFlow ? 'QR Feedback' : 'Receipt Feedback',
          reviewDate: new Date(),
          detectedLanguage: 'en',
          textLength: reviewContent.length,
          qualityFlags: spamResult.flagged ? ['flagged_spam'] : [],
          rawData: {
            source: 'till_slip',
            submissionId: submission.id,
            positiveThemes: body.positiveThemes,
            negativeThemes: body.negativeThemes,
            spamScore: spamResult.score,
            spamReasons: spamResult.reasons,
            isShortCodeFlow,
          },
        },
      });

      // Create theme associations with high confidence
      // These are directly selected by the user so we trust them
      await createThemeAssociations(
        review.id,
        body.positiveThemes || [],
        body.negativeThemes || [],
        tenantId
      );
    }

    // Fetch full settings for response if we only have partial
    let responseSettings = settings;
    if (isShortCodeFlow) {
      const fullSettings = await getSettingsByShortCode(token);
      responseSettings = fullSettings ? {
        incentiveType: fullSettings.incentiveType,
        discountPercent: fullSettings.discountPercent,
        tokenExpiryDays: fullSettings.tokenExpiryDays,
        discountTerms: fullSettings.discountTerms || undefined,
        prizeDrawTerms: fullSettings.prizeDrawTerms || undefined,
        redirectToGoogleReview: fullSettings.redirectToGoogleReview,
        googleReviewUrl: fullSettings.googleReviewUrl || undefined,
      } as typeof settings : settings;
    }

    return NextResponse.json({
      success: true,
      incentiveType: responseSettings?.incentiveType,
      incentiveCode,
      incentiveCodeExpiry: incentiveCodeExpiry?.toISOString(),
      redemptionCode, // Short code for staff verification
      discountPercent: responseSettings?.discountPercent,
      discountTerms: (responseSettings as Record<string, unknown>)?.discountTerms,
      prizeDrawTerms: (responseSettings as Record<string, unknown>)?.prizeDrawTerms,
      redirectToGoogleReview: (responseSettings as Record<string, unknown>)?.redirectToGoogleReview,
      googleReviewUrl: (responseSettings as Record<string, unknown>)?.googleReviewUrl,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', errorMessage: 'Failed to submit feedback. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================
// ERROR MESSAGES
// ============================================================

function getErrorMessage(error?: string): string {
  switch (error) {
    case 'TOKEN_NOT_FOUND':
      return 'This feedback link is not valid. Please scan the QR code on your receipt again.';
    case 'TOKEN_EXPIRED':
      return 'This feedback link has expired. Please ask for a new receipt to share your experience.';
    case 'TOKEN_ALREADY_USED':
      return 'Feedback has already been submitted for this receipt. Thank you for sharing your experience!';
    case 'CHANNEL_INACTIVE':
      return 'Feedback collection is currently unavailable. Please try again later.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
