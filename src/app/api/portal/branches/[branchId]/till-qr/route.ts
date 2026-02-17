/**
 * API Route: Till Slip QR Code Generation
 * 
 * Generates QR codes for receipt feedback collection.
 * Supports PNG and SVG formats.
 * 
 * GET: Generate QR code for branch
 * Query params:
 *   - format: 'png' | 'svg' (default: 'png')
 *   - size: number (default: 300, max: 1000)
 *   - download: 'true' to trigger file download
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { hasTenantAccess } from '@/server/auth/rbac';
import QRCode from 'qrcode';

// ============================================================
// CONSTANTS
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pickd.co';
const MIN_SIZE = 100;
const MAX_SIZE = 1000;
const DEFAULT_SIZE = 300;

// QR code styling options
const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // High error correction for better scanning
  margin: 2,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
};

// ============================================================
// GET - Generate QR Code
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;

    // Check tenant access
    if (!hasTenantAccess(session.user, branchId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'png';
    const sizeParam = parseInt(searchParams.get('size') || String(DEFAULT_SIZE), 10);
    const download = searchParams.get('download') === 'true';

    // Validate format
    if (!['png', 'svg'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use "png" or "svg"' }, { status: 400 });
    }

    // Validate and clamp size
    const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, sizeParam));

    // Fetch settings
    const settings = await db.tillReviewSettings.findFirst({
      where: { tenantId: branchId },
      select: { shortCode: true, isActive: true },
    });

    if (!settings || !settings.shortCode) {
      return NextResponse.json(
        { error: 'Till slip settings not configured. Please enable receipt feedback and save settings first.' },
        { status: 404 }
      );
    }

    // Fetch tenant for naming
    const tenant = await db.tenant.findUnique({
      where: { id: branchId },
      select: { name: true, slug: true },
    });

    // Build the feedback URL using the short code
    // This URL redirects to the feedback form
    const feedbackUrl = `${BASE_URL}/r/${settings.shortCode}`;

    // Build filename
    const safeSlug = tenant?.slug?.replace(/[^a-zA-Z0-9-]/g, '') || branchId;

    // Generate QR code and return response
    if (format === 'svg') {
      const svgData = await QRCode.toString(feedbackUrl, {
        type: 'svg',
        ...QR_OPTIONS,
        width: size,
      });

      const response = new NextResponse(svgData, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (download) {
        response.headers.set('Content-Disposition', `attachment; filename="${safeSlug}-feedback-qr.svg"`);
      }

      return response;
    } else {
      const pngBuffer = await QRCode.toBuffer(feedbackUrl, {
        type: 'png',
        ...QR_OPTIONS,
        width: size,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      };

      if (download) {
        headers['Content-Disposition'] = `attachment; filename="${safeSlug}-feedback-qr.png"`;
      }

      // Use NextResponse with explicit cast for Node Buffer
      return new NextResponse(pngBuffer as unknown as BodyInit, { status: 200, headers });
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - Generate Sample QR Code (for preview)
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;

    // Check tenant access
    if (!hasTenantAccess(session.user, branchId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate a preview QR code with a sample URL
    const sampleUrl = `${BASE_URL}/r/sample-preview`;

    const qrDataUrl = await QRCode.toDataURL(sampleUrl, {
      ...QR_OPTIONS,
      width: 200,
    });

    return NextResponse.json({
      qrDataUrl,
      sampleUrl,
    });
  } catch (error) {
    console.error('Error generating preview QR:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
