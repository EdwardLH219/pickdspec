/**
 * API Route Authentication Wrappers
 * 
 * Provides consistent authentication and authorization checks for API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { 
  authorizePickdAdmin, 
  hasTenantAccess, 
  AuthorizationError,
  hasPermission,
} from '@/server/auth/rbac';
import type { SessionUser } from '@/lib/auth/types';
import type { Resource, Action } from '@/lib/auth/types';
import { logApiError } from '@/lib/logger';

/**
 * Authenticated request handler type
 */
export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: { user: SessionUser; params?: T }
) => Promise<NextResponse>;

/**
 * Admin-only request handler type
 */
export type AdminHandler<T = unknown> = (
  request: NextRequest,
  context: { user: SessionUser; params?: T }
) => Promise<NextResponse>;

/**
 * Tenant-scoped request handler type
 */
export type TenantScopedHandler<T = unknown> = (
  request: NextRequest,
  context: { user: SessionUser; tenantId: string; params?: T }
) => Promise<NextResponse>;

/**
 * Wrap an API handler with authentication check
 * Ensures the user is logged in before executing the handler
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context?: { params?: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<T> }) => {
    try {
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      
      const params = context?.params ? await context.params : undefined;
      return await handler(request, { user: session.user, params: params as T });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      
      logApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
        statusCode: 500,
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap an API handler with Pick'd admin check
 * Ensures the user is a Pick'd admin before executing the handler
 */
export function withAdmin<T = unknown>(
  handler: AdminHandler<T>
): (request: NextRequest, context?: { params?: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<T> }) => {
    try {
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      
      // Verify Pick'd admin status
      authorizePickdAdmin(session.user);
      
      const params = context?.params ? await context.params : undefined;
      return await handler(request, { user: session.user, params: params as T });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      
      logApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
        statusCode: 500,
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap an API handler with tenant access check
 * Extracts tenantId from query params or body and verifies access
 */
export function withTenantAccess<T = unknown>(
  handler: TenantScopedHandler<T>,
  options: {
    /** Where to find tenantId: 'query', 'body', or 'params' */
    tenantIdSource?: 'query' | 'body' | 'params';
    /** Parameter name for tenant ID */
    tenantIdParam?: string;
  } = {}
): (request: NextRequest, context?: { params?: Promise<T> }) => Promise<NextResponse> {
  const { tenantIdSource = 'query', tenantIdParam = 'tenantId' } = options;
  
  return async (request: NextRequest, context?: { params?: Promise<T> }) => {
    try {
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      
      const params = context?.params ? await context.params : undefined;
      
      // Extract tenant ID based on source
      let tenantId: string | null = null;
      
      if (tenantIdSource === 'query') {
        tenantId = request.nextUrl.searchParams.get(tenantIdParam);
      } else if (tenantIdSource === 'body') {
        const body = await request.clone().json();
        tenantId = body[tenantIdParam];
      } else if (tenantIdSource === 'params' && params) {
        tenantId = (params as Record<string, string>)[tenantIdParam];
      }
      
      if (!tenantId) {
        return NextResponse.json(
          { error: 'Tenant ID is required', code: 'TENANT_REQUIRED' },
          { status: 400 }
        );
      }
      
      // Verify tenant access
      if (!hasTenantAccess(session.user, tenantId)) {
        return NextResponse.json(
          { error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' },
          { status: 403 }
        );
      }
      
      return await handler(request, { 
        user: session.user, 
        tenantId, 
        params: params as T 
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      
      logApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
        statusCode: 500,
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap an API handler with resource permission check
 */
export function withPermission<T = unknown>(
  resource: Resource,
  action: Action,
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context?: { params?: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<T> }) => {
    try {
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      
      // Check permission
      if (!hasPermission(session.user.role, resource, action)) {
        return NextResponse.json(
          { error: `Permission denied: Cannot ${action} ${resource}`, code: 'PERMISSION_DENIED' },
          { status: 403 }
        );
      }
      
      const params = context?.params ? await context.params : undefined;
      return await handler(request, { user: session.user, params: params as T });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      
      logApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
        statusCode: 500,
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export default {
  withAuth,
  withAdmin,
  withTenantAccess,
  withPermission,
};
