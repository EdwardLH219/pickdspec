/**
 * Tenant Isolation Enforcement
 * 
 * Provides utilities to enforce tenant-scoped database queries,
 * preventing cross-tenant data access.
 */

import { db } from '@/server/db';
import { AuthorizationError, hasTenantAccess } from '@/server/auth/rbac';
import type { SessionUser } from '@/lib/auth/types';
import type { Prisma } from '@prisma/client';

/**
 * Tenant-scoped query context
 */
export interface TenantContext {
  user: SessionUser;
  tenantId: string;
}

/**
 * Create a tenant-scoped query context
 * Validates that the user has access to the requested tenant
 * 
 * @throws {AuthorizationError} If user doesn't have access to tenant
 */
export function createTenantContext(
  user: SessionUser,
  tenantId: string
): TenantContext {
  if (!hasTenantAccess(user, tenantId)) {
    throw new AuthorizationError(
      'Access denied: You do not have access to this tenant',
      'TENANT_ACCESS_DENIED',
      403
    );
  }
  
  return { user, tenantId };
}

/**
 * Get tenant IDs that a user can access
 * For Pick'd staff, returns undefined (no filter needed)
 * For regular users, returns their tenant access list
 */
export function getUserTenantIds(user: SessionUser): string[] | undefined {
  if (user.isPickdStaff) {
    return undefined; // No filter - can access all
  }
  return user.tenantAccess;
}

/**
 * Build a Prisma where clause that enforces tenant isolation
 * 
 * @param user - The session user
 * @param requestedTenantId - Optional specific tenant ID to query
 * @returns Where clause with tenant filter
 */
export function tenantWhere<T extends { tenantId?: unknown }>(
  user: SessionUser,
  requestedTenantId?: string | null
): Partial<T> {
  // If specific tenant requested, validate access
  if (requestedTenantId) {
    if (!hasTenantAccess(user, requestedTenantId)) {
      throw new AuthorizationError(
        'Access denied: You do not have access to this tenant',
        'TENANT_ACCESS_DENIED',
        403
      );
    }
    return { tenantId: requestedTenantId } as Partial<T>;
  }
  
  // Pick'd staff can access all - return empty filter
  if (user.isPickdStaff) {
    return {} as Partial<T>;
  }
  
  // Regular users - filter by their tenant access
  if (user.tenantAccess.length === 0) {
    throw new AuthorizationError(
      'Access denied: No tenant access configured',
      'NO_TENANT_ACCESS',
      403
    );
  }
  
  if (user.tenantAccess.length === 1) {
    return { tenantId: user.tenantAccess[0] } as Partial<T>;
  }
  
  return { tenantId: { in: user.tenantAccess } } as Partial<T>;
}

/**
 * Tenant-scoped Prisma client wrapper
 * Provides a safe interface for tenant-isolated database queries
 */
export function createTenantScopedClient(ctx: TenantContext) {
  const { tenantId } = ctx;

  return {
    /**
     * Find reviews scoped to tenant
     */
    review: {
      findMany: <T extends Prisma.ReviewFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ReviewWhereInput }
      ) => {
        return db.review.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
      findFirst: <T extends Prisma.ReviewFindFirstArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ReviewWhereInput }
      ) => {
        return db.review.findFirst({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
      count: (args?: Omit<Prisma.ReviewCountArgs, 'where'> & { where?: Prisma.ReviewWhereInput }) => {
        return db.review.count({
          ...args,
          where: { ...args?.where, tenantId },
        });
      },
    },

    /**
     * Find score runs scoped to tenant
     */
    scoreRun: {
      findMany: <T extends Prisma.ScoreRunFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ScoreRunWhereInput }
      ) => {
        return db.scoreRun.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
      findFirst: <T extends Prisma.ScoreRunFindFirstArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ScoreRunWhereInput }
      ) => {
        return db.scoreRun.findFirst({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
    },

    /**
     * Find recommendations scoped to tenant
     */
    recommendation: {
      findMany: <T extends Prisma.RecommendationFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.RecommendationWhereInput }
      ) => {
        return db.recommendation.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
    },

    /**
     * Find tasks scoped to tenant
     */
    task: {
      findMany: <T extends Prisma.TaskFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.TaskWhereInput }
      ) => {
        return db.task.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
      findUnique: async <T extends Prisma.TaskFindUniqueArgs>(args: T) => {
        const task = await db.task.findUnique(args);
        // Verify tenant access on found record
        if (task && task.tenantId !== tenantId) {
          throw new AuthorizationError(
            'Access denied: Task belongs to different tenant',
            'TENANT_ACCESS_DENIED',
            403
          );
        }
        return task;
      },
      create: <T extends Prisma.TaskCreateArgs>(
        args: Omit<T, 'data'> & { data: Omit<Prisma.TaskCreateInput, 'tenant'> & { tenantId?: string } }
      ) => {
        return db.task.create({
          ...args,
          data: { ...args.data, tenant: { connect: { id: tenantId } } },
        } as T);
      },
      update: async <T extends Prisma.TaskUpdateArgs>(args: T) => {
        // First verify the task belongs to this tenant
        const existing = await db.task.findUnique({ where: args.where });
        if (!existing) {
          throw new Error('Task not found');
        }
        if (existing.tenantId !== tenantId) {
          throw new AuthorizationError(
            'Access denied: Task belongs to different tenant',
            'TENANT_ACCESS_DENIED',
            403
          );
        }
        return db.task.update(args);
      },
      delete: async <T extends Prisma.TaskDeleteArgs>(args: T) => {
        // First verify the task belongs to this tenant
        const existing = await db.task.findUnique({ where: args.where });
        if (!existing) {
          throw new Error('Task not found');
        }
        if (existing.tenantId !== tenantId) {
          throw new AuthorizationError(
            'Access denied: Task belongs to different tenant',
            'TENANT_ACCESS_DENIED',
            403
          );
        }
        return db.task.delete(args);
      },
    },

    /**
     * Find connectors scoped to tenant
     */
    connector: {
      findMany: <T extends Prisma.ConnectorFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ConnectorWhereInput }
      ) => {
        return db.connector.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        } as T);
      },
      findUnique: async <T extends Prisma.ConnectorFindUniqueArgs>(args: T) => {
        const connector = await db.connector.findUnique(args);
        if (connector && connector.tenantId !== tenantId) {
          throw new AuthorizationError(
            'Access denied: Connector belongs to different tenant',
            'TENANT_ACCESS_DENIED',
            403
          );
        }
        return connector;
      },
    },

    /**
     * Find themes (includes system themes)
     */
    theme: {
      findMany: <T extends Prisma.ThemeFindManyArgs>(
        args?: Omit<T, 'where'> & { where?: Prisma.ThemeWhereInput }
      ) => {
        return db.theme.findMany({
          ...args,
          where: {
            ...args?.where,
            OR: [
              { isSystem: true },
              { tenantId },
            ],
          },
        } as T);
      },
    },

    /**
     * Raw tenant ID for manual queries
     */
    tenantId,
  };
}

/**
 * Verify that a record belongs to a specific tenant
 * 
 * @throws {AuthorizationError} If record doesn't belong to tenant
 */
export function verifyTenantOwnership(
  record: { tenantId: string } | null,
  expectedTenantId: string,
  resourceName: string
): void {
  if (!record) {
    return; // Let caller handle not found
  }
  
  if (record.tenantId !== expectedTenantId) {
    throw new AuthorizationError(
      `Access denied: ${resourceName} belongs to different tenant`,
      'TENANT_ACCESS_DENIED',
      403
    );
  }
}

/**
 * Type guard to check if error is an authorization error
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export default {
  createTenantContext,
  createTenantScopedClient,
  getUserTenantIds,
  tenantWhere,
  verifyTenantOwnership,
  isAuthorizationError,
};
