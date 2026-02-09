/**
 * API: Connector Run History
 * 
 * Get ingestion run history for a specific connector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ingestion/connectors/[id]/runs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get connector to verify access
    const connector = await db.connector.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Check access - Pick'd staff can access all, others need tenant access
    if (!session.user.isPickdStaff && !session.user.tenantAccess.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch runs with errors
    const rawRuns = await db.ingestionRun.findMany({
      where: { connectorId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        errors: {
          select: {
            errorType: true,
            errorMessage: true,
            context: true,
          },
          take: 50,
        },
      },
    });

    // Transform to include duration and error details
    const runs = rawRuns.map(run => ({
      id: run.id,
      status: run.status,
      runType: run.runType,
      reviewsFetched: run.reviewsFetched,
      reviewsCreated: run.reviewsCreated,
      reviewsUpdated: run.reviewsUpdated,
      reviewsSkipped: run.reviewsSkipped,
      errorCount: run.errorCount,
      durationMs: run.startedAt && run.completedAt 
        ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
        : null,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      errorDetails: run.errors.map(e => ({
        type: e.errorType,
        message: e.errorMessage,
        reviewId: e.context && typeof e.context === 'object' ? (e.context as Record<string, unknown>).reviewId as string | undefined : undefined,
      })),
    }));

    return NextResponse.json({ runs });

  } catch (error) {
    console.error('Error fetching connector runs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
