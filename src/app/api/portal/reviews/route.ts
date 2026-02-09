/**
 * Portal API: Reviews (Review Explorer)
 * 
 * Filter and export reviews with theme data.
 * 
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { SourceType } from '@prisma/client';
import { rateLimitByUser, RateLimiters } from '@/server/security/rate-limit';
import { sanitizeReviewContent, sanitizeAuthorName, escapeHtml } from '@/server/security/sanitize';
import { audit } from '@/server/audit/service';

/**
 * GET /api/portal/reviews
 * Get reviews with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const sourceType = searchParams.get('source') as SourceType | null;
    const themeId = searchParams.get('themeId');
    const sentiment = searchParams.get('sentiment'); // positive, neutral, negative
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const format = searchParams.get('format'); // json or csv

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Rate limit CSV exports (per user)
    if (format === 'csv') {
      const rateLimitResult = rateLimitByUser(
        request,
        'review-export',
        session.user.id,
        RateLimiters.export
      );
      if (rateLimitResult) return rateLimitResult;
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    
    if (sourceType) {
      where.connector = { sourceType };
    }
    
    if (themeId) {
      where.reviewThemes = { some: { themeId } };
    }
    
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) (where.rating as Record<string, unknown>).gte = parseInt(minRating, 10);
      if (maxRating) (where.rating as Record<string, unknown>).lte = parseInt(maxRating, 10);
    }
    
    if (dateFrom || dateTo) {
      where.reviewDate = {};
      if (dateFrom) (where.reviewDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.reviewDate as Record<string, unknown>).lte = new Date(dateTo);
    }
    
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get reviews
    const reviews = await db.review.findMany({
      where,
      include: {
        connector: { select: { sourceType: true, name: true } },
        reviewThemes: {
          include: {
            theme: { select: { id: true, name: true, category: true } },
          },
        },
        reviewScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            baseSentiment: true,
            weightedImpact: true,
          },
        },
      },
      orderBy: { reviewDate: 'desc' },
      take: format === 'csv' ? 10000 : limit, // Higher limit for CSV export
      skip: format === 'csv' ? 0 : offset,
    });

    // Filter by sentiment if specified (post-query since it's from reviewScores)
    let filteredReviews = reviews;
    if (sentiment) {
      filteredReviews = reviews.filter(r => {
        const score = r.reviewScores[0]?.baseSentiment ?? 0;
        if (sentiment === 'positive') return score > 0.3;
        if (sentiment === 'negative') return score < -0.3;
        if (sentiment === 'neutral') return score >= -0.3 && score <= 0.3;
        return true;
      });
    }

    // Format reviews with XSS sanitization
    const formattedReviews = filteredReviews.map(r => ({
      id: r.id,
      content: sanitizeReviewContent(r.content),
      rating: r.rating,
      reviewDate: r.reviewDate,
      authorName: sanitizeAuthorName(r.authorName),
      source: r.connector.sourceType,
      sourceName: escapeHtml(r.connector.name),
      externalUrl: null, // Not stored in current schema
      sentiment: r.reviewScores[0]?.baseSentiment ?? null,
      weightedImpact: r.reviewScores[0]?.weightedImpact ?? null,
      themes: r.reviewThemes.map(rt => ({
        id: rt.theme.id,
        name: escapeHtml(rt.theme.name),
        category: rt.theme.category,
        sentiment: rt.sentiment,
        confidence: rt.confidenceScore,
      })),
      likesCount: r.likesCount,
      repliesCount: r.repliesCount,
      helpfulCount: r.helpfulCount,
    }));

    // CSV export
    if (format === 'csv') {
      const csvRows = [
        ['Date', 'Source', 'Rating', 'Sentiment', 'Author', 'Content', 'Themes', 'Likes', 'Replies', 'Helpful', 'URL'].join(','),
        ...formattedReviews.map(r => [
          r.reviewDate ? new Date(r.reviewDate).toISOString().split('T')[0] : '',
          r.source,
          r.rating ?? '',
          r.sentiment?.toFixed(2) ?? '',
          `"${(r.authorName || '').replace(/"/g, '""')}"`,
          `"${(r.content || '').replace(/"/g, '""').substring(0, 500)}"`,
          `"${r.themes.map(t => t.name).join(', ')}"`,
          r.likesCount,
          r.repliesCount,
          r.helpfulCount,
          r.externalUrl || '',
        ].join(',')),
      ].join('\n');

      // Audit log the export
      await audit.dataExported(
        session.user,
        'Review',
        tenantId,
        'csv',
        formattedReviews.length
      );

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reviews-${tenantId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Get total count
    const total = await db.review.count({ where });

    return NextResponse.json({
      reviews: formattedReviews,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
