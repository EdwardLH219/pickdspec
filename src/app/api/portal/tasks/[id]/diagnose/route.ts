/**
 * Diagnose FixScore data availability for a task
 * 
 * GET: Returns detailed information about why FixScore might show insufficient data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get the task with theme info
  const task = await db.task.findUnique({
    where: { id },
    include: {
      theme: { select: { id: true, name: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, task.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!task.themeId || !task.theme) {
    return NextResponse.json({
      error: 'Task has no associated theme',
      diagnosis: {
        issue: 'NO_THEME',
        message: 'This task is not linked to any theme. FixScore requires a theme to measure.',
      },
    });
  }

  // Get completion date
  const completionDate = task.completedAt || new Date();
  
  // Calculate windows (90 days pre, 60 days post - matching fixscore.ts)
  const preStart = new Date(completionDate);
  preStart.setDate(preStart.getDate() - 90);
  const preEnd = new Date(completionDate);
  preEnd.setDate(preEnd.getDate() - 1);
  
  const postStart = new Date(completionDate);
  const postEnd = new Date(completionDate);
  postEnd.setDate(postEnd.getDate() + 60);

  // Get latest score run
  const latestRun = await db.scoreRun.findFirst({
    where: { tenantId: task.tenantId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true, completedAt: true, periodStart: true, periodEnd: true },
  });

  // Get ALL reviews for tenant
  const allReviews = await db.review.findMany({
    where: { tenantId: task.tenantId },
    select: { 
      id: true, 
      reviewDate: true, 
      content: true,
      reviewThemes: {
        select: { themeId: true, theme: { select: { name: true } } }
      },
    },
    orderBy: { reviewDate: 'asc' },
  });

  // Get reviews tagged with this theme
  const reviewsWithTheme = allReviews.filter(r => 
    r.reviewThemes.some(rt => rt.themeId === task.themeId)
  );

  // Get reviews in pre-period with this theme
  const preReviewsWithTheme = reviewsWithTheme.filter(r => 
    r.reviewDate && r.reviewDate >= preStart && r.reviewDate <= preEnd
  );

  // Get reviews in post-period with this theme
  const postReviewsWithTheme = reviewsWithTheme.filter(r => 
    r.reviewDate && r.reviewDate >= postStart && r.reviewDate <= postEnd
  );

  // Check if reviews have scores from latest run
  let preReviewsWithScores = 0;
  let postReviewsWithScores = 0;
  
  if (latestRun) {
    const reviewIds = [...preReviewsWithTheme, ...postReviewsWithTheme].map(r => r.id);
    const scoresFromRun = await db.reviewScore.findMany({
      where: {
        scoreRunId: latestRun.id,
        reviewId: { in: reviewIds },
      },
      select: { reviewId: true },
    });
    const scoredReviewIds = new Set(scoresFromRun.map(s => s.reviewId));
    
    preReviewsWithScores = preReviewsWithTheme.filter(r => scoredReviewIds.has(r.id)).length;
    postReviewsWithScores = postReviewsWithTheme.filter(r => scoredReviewIds.has(r.id)).length;
  }

  // Determine the issue
  let issue: string;
  let message: string;
  let suggestion: string;

  if (!latestRun) {
    issue = 'NO_SCORE_RUN';
    message = 'No scoring run has been completed. Reviews need to be scored first.';
    suggestion = 'Go to Data Sources and run scoring.';
  } else if (reviewsWithTheme.length === 0) {
    issue = 'NO_THEME_TAGS';
    message = `No reviews are tagged with the "${task.theme.name}" theme.`;
    suggestion = 'Run scoring again to extract themes from reviews, or check if reviews mention this theme.';
  } else if (preReviewsWithTheme.length === 0) {
    issue = 'NO_PRE_REVIEWS';
    message = `No reviews tagged with "${task.theme.name}" exist in the 90-day pre-period (${preStart.toLocaleDateString()} - ${preEnd.toLocaleDateString()}).`;
    suggestion = 'The completion date might be set incorrectly, or reviews from before the task completion are needed.';
  } else if (postReviewsWithTheme.length === 0) {
    issue = 'NO_POST_REVIEWS';
    message = `No reviews tagged with "${task.theme.name}" exist in the 60-day post-period (${postStart.toLocaleDateString()} - ${postEnd.toLocaleDateString()}).`;
    suggestion = 'More reviews are needed after the task completion date to measure improvement.';
  } else if (preReviewsWithScores === 0 || postReviewsWithScores === 0) {
    issue = 'MISSING_SCORES';
    message = 'Reviews exist but don\'t have scores from the latest scoring run.';
    suggestion = 'Run scoring again to create scores for all reviews.';
  } else {
    issue = 'UNKNOWN';
    message = 'Unable to determine the specific issue.';
    suggestion = 'Try running scoring again and then recalculating FixScore.';
  }

  // Get sample reviews for debugging
  const sampleReviewsWithTheme = reviewsWithTheme.slice(0, 5).map(r => ({
    id: r.id.slice(0, 8) + '...',
    date: r.reviewDate?.toISOString().split('T')[0],
    snippet: r.content.slice(0, 80) + (r.content.length > 80 ? '...' : ''),
  }));

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      themeName: task.theme.name,
      themeId: task.themeId,
      completedAt: completionDate.toISOString(),
      status: task.status,
    },
    windows: {
      prePeriod: {
        start: preStart.toISOString(),
        end: preEnd.toISOString(),
        label: `${preStart.toLocaleDateString()} - ${preEnd.toLocaleDateString()}`,
      },
      postPeriod: {
        start: postStart.toISOString(),
        end: postEnd.toISOString(),
        label: `${postStart.toLocaleDateString()} - ${postEnd.toLocaleDateString()}`,
      },
    },
    reviewCounts: {
      totalReviews: allReviews.length,
      reviewsWithTheme: reviewsWithTheme.length,
      preReviewsWithTheme: preReviewsWithTheme.length,
      preReviewsWithScores,
      postReviewsWithTheme: postReviewsWithTheme.length,
      postReviewsWithScores,
    },
    latestScoreRun: latestRun ? {
      id: latestRun.id.slice(0, 8) + '...',
      completedAt: latestRun.completedAt?.toISOString(),
      periodStart: latestRun.periodStart?.toISOString(),
      periodEnd: latestRun.periodEnd?.toISOString(),
    } : null,
    diagnosis: {
      issue,
      message,
      suggestion,
    },
    sampleReviewsWithTheme,
  });
}
