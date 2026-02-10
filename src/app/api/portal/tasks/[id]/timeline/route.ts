/**
 * Timeline data for FixScore visualization
 * GET: Returns review sentiment data points for pre/post periods
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

  // Get the task
  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      themeId: true,
      completedAt: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, task.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!task.themeId || !task.completedAt) {
    return NextResponse.json({ 
      error: 'Task has no theme or completion date',
      timeline: null,
    });
  }

  // Get the latest score run
  const latestRun = await db.scoreRun.findFirst({
    where: { tenantId: task.tenantId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });

  if (!latestRun) {
    return NextResponse.json({ 
      error: 'No completed score run',
      timeline: null,
    });
  }

  // Calculate date windows (30 days before/after)
  const completionDate = task.completedAt;
  const preStart = new Date(completionDate);
  preStart.setDate(preStart.getDate() - 30);
  const postEnd = new Date(completionDate);
  postEnd.setDate(postEnd.getDate() + 30);

  // Get all reviews with this theme in the extended period
  const reviews = await db.review.findMany({
    where: {
      tenantId: task.tenantId,
      reviewDate: { gte: preStart, lte: postEnd },
      reviewThemes: { some: { themeId: task.themeId } },
    },
    include: {
      reviewThemes: { 
        where: { themeId: task.themeId },
        select: { sentiment: true, confidenceScore: true },
      },
      reviewScores: { 
        where: { scoreRunId: latestRun.id },
        select: { baseSentiment: true, weightedImpact: true },
      },
    },
    orderBy: { reviewDate: 'asc' },
  });

  // Transform to timeline data points
  const dataPoints = reviews
    .filter(r => r.reviewScores.length > 0 && r.reviewDate)
    .map(r => {
      const reviewDate = r.reviewDate!;
      const isPre = reviewDate < completionDate;
      const score = r.reviewScores[0];
      
      return {
        date: reviewDate.toISOString().split('T')[0],
        timestamp: reviewDate.getTime(),
        sentiment: score.baseSentiment,
        impact: score.weightedImpact,
        // Convert sentiment [-1, 1] to score [0, 10]
        score010: 5 * (score.baseSentiment + 1),
        period: isPre ? 'pre' : 'post',
        themeSentiment: r.reviewThemes[0]?.sentiment || 'NEUTRAL',
      };
    });

  // Group by date and calculate daily averages
  const dailyData = new Map<string, { date: string; scores: number[]; period: string }>();
  
  for (const point of dataPoints) {
    if (!dailyData.has(point.date)) {
      dailyData.set(point.date, { date: point.date, scores: [], period: point.period });
    }
    dailyData.get(point.date)!.scores.push(point.score010);
  }

  const aggregatedTimeline = Array.from(dailyData.values())
    .map(d => ({
      date: d.date,
      score: d.scores.reduce((a, b) => a + b, 0) / d.scores.length,
      reviewCount: d.scores.length,
      period: d.period,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate period averages
  const preScores = aggregatedTimeline.filter(d => d.period === 'pre').map(d => d.score);
  const postScores = aggregatedTimeline.filter(d => d.period === 'post').map(d => d.score);
  
  const preAvg = preScores.length > 0 ? preScores.reduce((a, b) => a + b, 0) / preScores.length : null;
  const postAvg = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : null;

  return NextResponse.json({
    timeline: aggregatedTimeline,
    completionDate: completionDate.toISOString().split('T')[0],
    preStart: preStart.toISOString().split('T')[0],
    postEnd: postEnd.toISOString().split('T')[0],
    stats: {
      preReviews: dataPoints.filter(d => d.period === 'pre').length,
      postReviews: dataPoints.filter(d => d.period === 'post').length,
      preAvgScore: preAvg,
      postAvgScore: postAvg,
    },
  });
}
