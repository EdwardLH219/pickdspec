/**
 * Admin API: Audit Logs
 * 
 * View and filter system audit logs.
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { AuditAction, UserRole, Prisma } from '@prisma/client';

/**
 * GET /api/admin/audit-logs
 * 
 * Query audit logs with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const action = searchParams.get('action') as AuditAction | null;
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const actorId = searchParams.get('actorId');
    const actorEmail = searchParams.get('actorEmail');
    const actorRole = searchParams.get('actorRole') as UserRole | null;
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const requestId = searchParams.get('requestId');
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    
    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};
    
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (actorId) where.actorId = actorId;
    if (actorEmail) where.actorEmail = { contains: actorEmail, mode: 'insensitive' };
    if (actorRole) where.actorRole = actorRole;
    if (tenantId) where.tenantId = tenantId;
    if (requestId) where.requestId = requestId;
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    // Full-text search across multiple fields
    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Build orderBy
    const validSortFields = ['createdAt', 'action', 'resourceType', 'actorEmail'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);
    
    // Format response
    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      actor: {
        id: log.actor.id,
        email: log.actor.email,
        name: [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ') || log.actor.email,
        role: log.actor.role,
      },
      tenantId: log.tenantId,
      organizationId: log.organizationId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      requestId: log.requestId,
      createdAt: log.createdAt.toISOString(),
    }));
    
    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/audit-logs/stats
 * 
 * Get audit log statistics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    // Get action counts for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [actionCounts, resourceCounts, recentActivity, topActors] = await Promise.all([
      // Count by action type
      db.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      
      // Count by resource type
      db.auditLog.groupBy({
        by: ['resourceType'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      
      // Daily activity for last 30 days
      db.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM "AuditLog"
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
      
      // Top actors
      db.auditLog.groupBy({
        by: ['actorEmail'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);
    
    return NextResponse.json({
      stats: {
        actionCounts: actionCounts.map(a => ({
          action: a.action,
          count: a._count.id,
        })),
        resourceCounts: resourceCounts.map(r => ({
          resourceType: r.resourceType,
          count: r._count.id,
        })),
        dailyActivity: recentActivity.map(d => ({
          date: d.date,
          count: Number(d.count),
        })),
        topActors: topActors.map(a => ({
          email: a.actorEmail,
          count: a._count.id,
        })),
      },
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching audit log stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
