/**
 * API Route: Deferred Token Minting (Option B)
 * 
 * Mints a token on first customer visit when POS printed a URL with
 * receipt reference instead of pre-minted token.
 * 
 * URL Format: https://app.pickd.co/r/b/{branchId}?ref={receiptRef}&t={timestamp}
 * 
 * Flow:
 * 1. POS prints QR with URL containing receipt ref (no API call needed)
 * 2. Customer scans QR
 * 3. This endpoint receives request, checks if token already exists
 * 4. If not, mints new token and redirects to feedback form
 * 5. Subsequent scans for same receipt use existing token
 * 
 * GET /api/branches/{branchId}/till/mint-on-visit?ref={receiptRef}&t={timestamp}
 * 
 * No authentication required - this is a public endpoint
 * Protected by HMAC signature to prevent URL manipulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { 
  mintReceiptToken, 
  buildFeedbackUrl, 
  hashReceiptRef,
  verifyReceiptToken 
} from '@/server/till-slip';
import crypto from 'crypto';

// ============================================================
// CONSTANTS
// ============================================================

/** Maximum age of timestamp to accept (24 hours) */
const MAX_TIMESTAMP_AGE_MS = 24 * 60 * 60 * 1000;

/** Secret for URL signing (should be in env) */
const URL_SIGNING_SECRET = process.env.URL_SIGNING_SECRET || 'pickd-url-secret';

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate HMAC signature for URL verification
 * This prevents URL manipulation and ensures authenticity
 */
function generateUrlSignature(branchId: string, receiptRef: string, timestamp: number): string {
  const data = `${branchId}:${receiptRef}:${timestamp}`;
  return crypto.createHmac('sha256', URL_SIGNING_SECRET)
    .update(data)
    .digest('hex')
    .slice(0, 16); // First 16 chars for shorter URLs
}

/**
 * Verify URL signature
 */
function verifyUrlSignature(
  branchId: string, 
  receiptRef: string, 
  timestamp: number, 
  providedSig: string
): boolean {
  const expectedSig = generateUrlSignature(branchId, receiptRef, timestamp);
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(providedSig)
    );
  } catch {
    return false;
  }
}

// ============================================================
// GET HANDLER
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
): Promise<NextResponse> {
  try {
    const { branchId } = await params;
    const { searchParams } = new URL(request.url);
    
    const receiptRef = searchParams.get('ref');
    const timestampStr = searchParams.get('t');
    const signature = searchParams.get('s'); // Optional signature for security

    // ============================================================
    // VALIDATE PARAMETERS
    // ============================================================

    if (!receiptRef) {
      return NextResponse.redirect(new URL('/feedback/error?code=MISSING_REF', request.url));
    }

    // Validate timestamp if provided
    if (timestampStr) {
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        return NextResponse.redirect(new URL('/feedback/error?code=INVALID_TIMESTAMP', request.url));
      }

      const age = Date.now() - timestamp * 1000;
      if (age > MAX_TIMESTAMP_AGE_MS) {
        return NextResponse.redirect(new URL('/feedback/error?code=EXPIRED_LINK', request.url));
      }

      // Verify signature if timestamp is present (recommended security)
      if (signature) {
        if (!verifyUrlSignature(branchId, receiptRef, timestamp, signature)) {
          return NextResponse.redirect(new URL('/feedback/error?code=INVALID_SIGNATURE', request.url));
        }
      }
    }

    // ============================================================
    // VERIFY BRANCH
    // ============================================================

    const settings = await db.tillReviewSettings.findUnique({
      where: { tenantId: branchId },
      select: { 
        id: true, 
        isActive: true,
        tokenExpiryDays: true,
      },
    });

    if (!settings) {
      return NextResponse.redirect(new URL('/feedback/error?code=CHANNEL_NOT_FOUND', request.url));
    }

    if (!settings.isActive) {
      return NextResponse.redirect(new URL('/feedback/error?code=CHANNEL_INACTIVE', request.url));
    }

    // ============================================================
    // CHECK FOR EXISTING TOKEN
    // ============================================================

    // Hash the receipt ref to look up
    const receiptRefHash = hashReceiptRef(receiptRef, branchId);

    // Check if we already have a token for this receipt
    const existingReceipt = await db.tillReceipt.findFirst({
      where: {
        tenantId: branchId,
        receiptRefHash,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingReceipt) {
      // Receipt already has a token - verify and redirect
      const verifyResult = await verifyReceiptToken(existingReceipt.token);
      
      if (verifyResult.valid) {
        // Token is still valid - redirect to feedback form
        return NextResponse.redirect(new URL(`/r/${existingReceipt.token}`, request.url));
      }
      
      // Token is expired/used - check error
      if (verifyResult.error === 'TOKEN_ALREADY_USED') {
        return NextResponse.redirect(new URL('/feedback/error?code=ALREADY_SUBMITTED', request.url));
      }
      
      if (verifyResult.error === 'TOKEN_EXPIRED') {
        // Token expired - could mint new one or show error
        // For now, show error - receipts should be collected quickly
        return NextResponse.redirect(new URL('/feedback/error?code=EXPIRED_RECEIPT', request.url));
      }
    }

    // ============================================================
    // MINT NEW TOKEN
    // ============================================================

    try {
      const result = await mintReceiptToken(branchId, {
        receiptRef,
        meta: {
          mintedVia: 'deferred',
          originalUrl: request.url,
        },
      });

      // Log successful deferred mint
      console.log(`[Till Deferred Mint] Branch ${branchId}: Receipt ${receiptRef.slice(-4)} minted`);

      // Redirect to the feedback form
      return NextResponse.redirect(new URL(`/r/${result.token}`, request.url));
    } catch (mintError) {
      const errorMessage = mintError instanceof Error ? mintError.message : 'Unknown error';
      
      if (errorMessage.includes('already been used')) {
        return NextResponse.redirect(new URL('/feedback/error?code=DUPLICATE_RECEIPT', request.url));
      }
      
      console.error('Error minting deferred token:', mintError);
      return NextResponse.redirect(new URL('/feedback/error?code=MINT_FAILED', request.url));
    }
  } catch (error) {
    console.error('Error in mint-on-visit:', error);
    return NextResponse.redirect(new URL('/feedback/error?code=INTERNAL_ERROR', request.url));
  }
}

// ============================================================
// POST HANDLER - Generate signed URL for POS
// ============================================================

/**
 * Generate a signed URL for Option B integration
 * Called by POS to get a URL to print (without minting token yet)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
): Promise<NextResponse> {
  try {
    const { branchId } = await params;
    const body = await request.json();
    
    const receiptRef = body.receiptRef;
    if (!receiptRef || typeof receiptRef !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'receiptRef is required',
      }, { status: 400 });
    }

    // Verify branch exists
    const settings = await db.tillReviewSettings.findUnique({
      where: { tenantId: branchId },
      select: { isActive: true },
    });

    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'Channel not configured for this branch',
        errorCode: 'CHANNEL_NOT_FOUND',
      }, { status: 404 });
    }

    if (!settings.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Channel is not active',
        errorCode: 'CHANNEL_INACTIVE',
      }, { status: 400 });
    }

    // Generate timestamp and signature
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateUrlSignature(branchId, receiptRef, timestamp);

    // Build the URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://picktenterprise.vercel.app';
    const url = new URL(`/api/branches/${branchId}/till/mint-on-visit`, baseUrl);
    url.searchParams.set('ref', receiptRef);
    url.searchParams.set('t', timestamp.toString());
    url.searchParams.set('s', signature);

    // Also provide a shorter URL format that redirects
    const shortUrl = `${baseUrl}/r/b/${branchId}?ref=${encodeURIComponent(receiptRef)}&t=${timestamp}&s=${signature}`;

    return NextResponse.json({
      success: true,
      url: url.toString(),
      shortUrl,
      expiresAt: new Date(timestamp * 1000 + MAX_TIMESTAMP_AGE_MS).toISOString(),
      note: 'Token will be minted when customer first scans this URL',
    });
  } catch (error) {
    console.error('Error generating deferred URL:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
