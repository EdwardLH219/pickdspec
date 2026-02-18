/**
 * Recalculate FixScore for a completed task
 * 
 * POST: Triggers FixScore recalculation with latest reviews
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { computeAndPersistFixScore } from '@/server/scoring/fixscore';
import { TaskStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get the task
  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      themeId: true,
      status: true,
      completedAt: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, task.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Task must be completed
  if (task.status !== TaskStatus.COMPLETED) {
    return NextResponse.json({ error: 'Task must be completed to calculate impact' }, { status: 400 });
  }

  // Task must have a theme
  if (!task.themeId) {
    return NextResponse.json({ error: 'Task has no associated theme' }, { status: 400 });
  }

  try {
    // Get the latest score run for this tenant
    const latestRun = await db.scoreRun.findFirst({
      where: { tenantId: task.tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, completedAt: true },
    });

    if (!latestRun) {
      return NextResponse.json({ error: 'No completed score run found. Run scoring first.' }, { status: 400 });
    }

    // Debug: Check if reviews exist with this theme
    // Use extended windows (90 days pre, 60 days post) for better data capture
    const completionDate = task.completedAt || new Date();
    const preStart = new Date(completionDate);
    preStart.setDate(preStart.getDate() - 90); // Extended pre-window
    const postEnd = new Date(completionDate);
    postEnd.setDate(postEnd.getDate() + 60); // Extended post-window
    
    // Count reviews with this theme in each period
    const preReviews = await db.review.findMany({
      where: {
        tenantId: task.tenantId,
        reviewDate: { gte: preStart, lt: completionDate },
        reviewThemes: { some: { themeId: task.themeId } },
      },
      include: {
        reviewThemes: { where: { themeId: task.themeId } },
        reviewScores: { where: { scoreRunId: latestRun.id }, take: 1 },
      },
    });
    
    const postReviews = await db.review.findMany({
      where: {
        tenantId: task.tenantId,
        reviewDate: { gte: completionDate, lte: postEnd },
        reviewThemes: { some: { themeId: task.themeId } },
      },
      include: {
        reviewThemes: { where: { themeId: task.themeId } },
        reviewScores: { where: { scoreRunId: latestRun.id }, take: 1 },
      },
    });
    
    // Check total ReviewScores for this score run
    const totalScoresForRun = await db.reviewScore.count({
      where: { scoreRunId: latestRun.id },
    });
    
    // Check if reviews have ANY scores (from any run)
    const reviewsWithAnyScores = await db.reviewScore.count({
      where: {
        review: { tenantId: task.tenantId },
      },
    });
    
    // Get theme info for better debugging
    const theme = await db.theme.findUnique({ where: { id: task.themeId }, select: { name: true } });
    
    // Check ALL reviews for this tenant
    const allReviews = await db.review.findMany({
      where: { tenantId: task.tenantId },
      select: { id: true, reviewDate: true },
      orderBy: { reviewDate: 'asc' },
    });
    
    const reviewDateRange = allReviews.length > 0 
      ? `${allReviews[0].reviewDate?.toISOString()} to ${allReviews[allReviews.length - 1].reviewDate?.toISOString()}`
      : 'No reviews';
    
    console.log('=== FixScore Debug ===');
    console.log('Task ID:', task.id);
    console.log('Theme:', theme?.name, '(', task.themeId, ')');
    console.log('Completion Date:', completionDate.toISOString());
    console.log('Pre Period (90 days):', preStart.toISOString(), 'to', completionDate.toISOString());
    console.log('Post Period (60 days):', completionDate.toISOString(), 'to', postEnd.toISOString());
    console.log('All Reviews Date Range:', reviewDateRange);
    console.log('Total Reviews for Tenant:', allReviews.length);
    console.log('Pre Reviews with theme:', preReviews.length);
    console.log('Pre Reviews with scores (this run):', preReviews.filter(r => r.reviewScores.length > 0).length);
    console.log('Post Reviews with theme:', postReviews.length);
    console.log('Post Reviews with scores (this run):', postReviews.filter(r => r.reviewScores.length > 0).length);
    console.log('Latest Score Run:', latestRun.id, 'completed:', latestRun.completedAt?.toISOString());
    console.log('Total ReviewScores for this run:', totalScoresForRun);
    console.log('Total ReviewScores for tenant (any run):', reviewsWithAnyScores);
    
    // Show sample pre-reviews to debug
    if (preReviews.length > 0) {
      console.log('Sample pre reviews:');
      for (const r of preReviews.slice(0, 3)) {
        console.log(`  - ${r.id.slice(0, 8)}... date: ${r.reviewDate?.toISOString()}, hasScore: ${r.reviewScores.length > 0}`);
      }
    }

    // Delete any existing FixScore for this task
    await db.fixScore.deleteMany({
      where: { taskId: task.id },
    });

    // Recalculate FixScore
    const { id: fixScoreId, result } = await computeAndPersistFixScore({
      taskId: task.id,
      themeId: task.themeId,
      tenantId: task.tenantId,
      scoreRunId: latestRun.id,
      completionDate: task.completedAt || undefined,
    });

    return NextResponse.json({
      success: true,
      fixScore: {
        id: fixScoreId,
        score: result.fixScore,
        deltaS: result.deltaS,
        confidenceLevel: result.confidenceLevel,
        reviewCountPre: result.reviewCountPre,
        reviewCountPost: result.reviewCountPost,
      },
      debug: {
        themeId: task.themeId,
        completionDate: completionDate.toISOString(),
        preReviewsWithTheme: preReviews.length,
        preReviewsWithScores: preReviews.filter(r => r.reviewScores.length > 0).length,
        postReviewsWithTheme: postReviews.length,
        postReviewsWithScores: postReviews.filter(r => r.reviewScores.length > 0).length,
        latestScoreRun: latestRun.id,
      },
    });
  } catch (error) {
    console.error('Error recalculating FixScore:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to recalculate impact' 
    }, { status: 500 });
  }
}
