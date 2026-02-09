/**
 * Admin API: Audit Explorer
 * 
 * View review score breakdowns with all weights and reason codes
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';

/**
 * GET /api/admin/audit
 * Search and filter review scores for auditing
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const scoreRunId = searchParams.get('scoreRunId');
    const reviewId = searchParams.get('reviewId');
    const themeId = searchParams.get('themeId');
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    const maxConfidence = parseFloat(searchParams.get('maxConfidence') || '1');
    const sortBy = searchParams.get('sortBy') || 'weightedImpact';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (scoreRunId) where.scoreRunId = scoreRunId;
    if (reviewId) where.reviewId = reviewId;
    
    if (tenantId) {
      where.review = { tenantId };
    }
    
    // Confidence filter
    if (minConfidence > 0 || maxConfidence < 1) {
      where.confidenceWeight = {
        gte: minConfidence,
        lte: maxConfidence,
      };
    }
    
    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    orderBy[sortBy] = sortOrder as 'asc' | 'desc';
    
    const [scores, total] = await Promise.all([
      db.reviewScore.findMany({
        where,
        include: {
          review: {
            include: {
              connector: { select: { name: true, sourceType: true } },
              reviewThemes: {
                include: {
                  theme: { select: { id: true, name: true } },
                },
              },
            },
          },
          scoreRun: {
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              parameterVersionId: true,
              ruleSetVersionId: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      db.reviewScore.count({ where }),
    ]);
    
    // Enrich with component details
    const enrichedScores = scores.map(score => ({
      id: score.id,
      reviewId: score.reviewId,
      scoreRunId: score.scoreRunId,
      
      // Core scores
      baseSentiment: score.baseSentiment,
      timeWeight: score.timeWeight,
      sourceWeight: score.sourceWeight,
      engagementWeight: score.engagementWeight,
      confidenceWeight: score.confidenceWeight,
      weightedImpact: score.weightedImpact,
      
      // Full component breakdown
      components: score.components,
      
      // Review details
      review: {
        id: score.review.id,
        content: score.review.content,
        rating: score.review.rating,
        reviewDate: score.review.reviewDate,
        authorName: score.review.authorName,
        source: score.review.connector.sourceType,
        sourceName: score.review.connector.name,
        likesCount: score.review.likesCount,
        repliesCount: score.review.repliesCount,
        helpfulCount: score.review.helpfulCount,
      },
      
      // Themes
      themes: score.review.reviewThemes.map(rt => ({
        id: rt.theme.id,
        name: rt.theme.name,
        sentiment: rt.sentiment,
        confidenceScore: rt.confidenceScore,
      })),
      
      // Run context
      scoreRun: score.scoreRun,
    }));
    
    return NextResponse.json({
      scores: enrichedScores,
      total,
      limit,
      offset,
    });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching audit data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
