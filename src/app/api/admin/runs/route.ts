/**
 * Admin API: Score Runs
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { enqueueScoreRun } from '@/server/queue';
import { audit } from '@/server/audit/service';
import { rateLimitByUser, RateLimiters } from '@/server/security/rate-limit';

/**
 * GET /api/admin/runs
 * List all score runs with optional filters
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
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    
    const [runs, total] = await Promise.all([
      db.scoreRun.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true } },
          parameterVersion: { select: { id: true, name: true, versionNumber: true } },
          ruleSetVersion: { select: { id: true, name: true, versionNumber: true } },
          triggeredBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.scoreRun.count({ where }),
    ]);
    
    return NextResponse.json({ runs, total, limit, offset });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching score runs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/runs
 * Trigger a new score run
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    // Rate limit job triggers per user
    const rateLimitResult = rateLimitByUser(
      request,
      'score-run-trigger',
      session.user.id,
      RateLimiters.jobTrigger
    );
    if (rateLimitResult) return rateLimitResult;
    
    const body = await request.json();
    const {
      tenantId,
      periodStart,
      periodEnd,
      parameterVersionId,
      ruleSetVersionId,
      computeFixScores,
    } = body;
    
    // Validate required fields
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 });
    }
    
    // Validate tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    
    // Validate parameter version if specified
    if (parameterVersionId) {
      const paramVersion = await db.parameterSetVersion.findUnique({
        where: { id: parameterVersionId },
      });
      if (!paramVersion) {
        return NextResponse.json({ error: 'Parameter version not found' }, { status: 404 });
      }
    }
    
    // Enqueue the score run job
    const jobId = await enqueueScoreRun(
      tenantId,
      new Date(periodStart),
      new Date(periodEnd),
      {
        parameterVersionId,
        ruleSetVersionId,
        computeFixScores: computeFixScores ?? true,
        triggeredById: session.user.id,
      }
    );
    
    // Audit log the score run trigger
    await audit.scoreRunTriggered(session.user, tenantId, jobId, {
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      parameterVersionId,
      ruleSetVersionId,
      computeFixScores: computeFixScores ?? true,
    });
    
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Score run queued',
      details: {
        tenantId,
        periodStart,
        periodEnd,
        parameterVersionId: parameterVersionId || 'active',
        ruleSetVersionId: ruleSetVersionId || 'active',
      },
    }, { status: 202 });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error triggering score run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
