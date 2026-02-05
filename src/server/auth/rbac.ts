/**
 * Role-Based Access Control (RBAC)
 * 
 * Comprehensive authorization utilities for the Pick'd platform.
 */

import { UserRole } from '@prisma/client';
import { 
  Resource, 
  Action, 
  ADMIN_ONLY_RESOURCES,
  ROLE_HIERARCHY,
  type SessionUser 
} from '@/lib/auth/types';

/**
 * Permission matrix - defines what each role can do
 */
const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  PICKD_ADMIN: {
    parameter_sets: ['create', 'read', 'update', 'delete'],
    score_runs: ['create', 'read', 'update', 'delete'],
    audit_logs: ['read'],
    all_tenants: ['create', 'read', 'update', 'delete'],
    dashboard: ['read'],
    reviews: ['read', 'update'],
    tasks: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read'],
    recommendations: ['read', 'update'],
    users: ['create', 'read', 'update', 'delete'],
    billing: ['read', 'update'],
    branches: ['create', 'read', 'update', 'delete'],
    organization: ['read', 'update'],
  },
  PICKD_SUPPORT: {
    parameter_sets: ['read'],
    score_runs: ['read'],
    audit_logs: ['read'],
    all_tenants: ['read'],
    dashboard: ['read'],
    reviews: ['read'],
    tasks: ['read'],
    reports: ['read'],
    recommendations: ['read'],
    users: ['read'],
    billing: ['read'],
    branches: ['read'],
    organization: ['read'],
  },
  OWNER: {
    dashboard: ['read'],
    reviews: ['read'],
    tasks: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    recommendations: ['read', 'update'],
    users: ['create', 'read', 'update', 'delete'],
    billing: ['read', 'update'],
    branches: ['create', 'read', 'update', 'delete'],
    organization: ['read', 'update'],
  },
  MANAGER: {
    dashboard: ['read'],
    reviews: ['read'],
    tasks: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    recommendations: ['read'],
    users: ['read'],
    branches: ['read'],
    organization: ['read'],
  },
  STAFF: {
    dashboard: ['read'],
    reviews: ['read'],
    tasks: ['read', 'update'],
    reports: ['read'],
    recommendations: ['read'],
    branches: ['read'],
  },
};

/**
 * Authorization error class
 */
export class AuthorizationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'FORBIDDEN', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Check if a user is Pick'd staff
 */
export function isPickdStaff(role: UserRole): boolean {
  return ROLE_HIERARCHY[role].isPickdStaff;
}

/**
 * Check if a resource is admin-only
 */
export function isAdminOnlyResource(resource: Resource): boolean {
  return ADMIN_ONLY_RESOURCES.includes(resource);
}

/**
 * Check if a role has permission for a specific action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSIONS[role];
  const resourcePermissions = rolePermissions[resource];
  
  if (!resourcePermissions) {
    return false;
  }
  
  return resourcePermissions.includes(action);
}

/**
 * Check if user has access to a specific tenant
 */
export function hasTenantAccess(
  user: SessionUser,
  tenantId: string
): boolean {
  // Pick'd staff can access all tenants
  if (user.isPickdStaff) {
    return true;
  }
  
  // Check if tenant is in user's access list
  return user.tenantAccess.includes(tenantId);
}

/**
 * Check if user has access to a specific organization
 */
export function hasOrganizationAccess(
  user: SessionUser,
  organizationId: string
): boolean {
  // Pick'd staff can access all organizations
  if (user.isPickdStaff) {
    return true;
  }
  
  // Check if user belongs to this organization
  return user.organizationId === organizationId;
}

/**
 * Authorize a request for a specific resource and action
 * 
 * @throws {AuthorizationError} If authorization fails
 */
export function authorize(
  user: SessionUser,
  resource: Resource,
  action: Action,
  tenantId?: string
): void {
  // Check admin-only resources
  if (isAdminOnlyResource(resource)) {
    if (!user.isPickdStaff) {
      throw new AuthorizationError(
        `Access denied: ${resource} is restricted to Pick'd staff only`,
        'ADMIN_ONLY'
      );
    }
  }

  // Check tenant access for non-staff users
  if (!user.isPickdStaff && tenantId) {
    if (!hasTenantAccess(user, tenantId)) {
      throw new AuthorizationError(
        'Access denied: You do not have access to this tenant',
        'TENANT_ACCESS_DENIED'
      );
    }
  }

  // Check role-based permission
  if (!hasPermission(user.role, resource, action)) {
    throw new AuthorizationError(
      `Permission denied: ${user.role} cannot ${action} ${resource}`,
      'PERMISSION_DENIED'
    );
  }
}

/**
 * Authorize Pick'd admin access
 * 
 * @throws {AuthorizationError} If user is not a Pick'd admin
 */
export function authorizePickdAdmin(user: SessionUser): void {
  if (!user.isPickdStaff || user.role !== 'PICKD_ADMIN') {
    throw new AuthorizationError(
      'Access denied: Pick\'d Admin only',
      'ADMIN_ONLY',
      403
    );
  }
}

/**
 * Get all resources a role can access
 */
export function getAccessibleResources(role: UserRole): Resource[] {
  const rolePermissions = PERMISSIONS[role];
  return Object.keys(rolePermissions) as Resource[];
}

/**
 * Filter tenant IDs based on user access
 */
export function filterTenantAccess(
  user: SessionUser,
  tenantIds: string[]
): string[] {
  if (user.isPickdStaff) {
    return tenantIds;
  }
  
  return tenantIds.filter(id => user.tenantAccess.includes(id));
}

/**
 * Build a where clause for tenant-scoped queries
 */
export function buildTenantWhereClause(
  user: SessionUser,
  requestedTenantId?: string
): { tenantId: string } | { tenantId: { in: string[] } } {
  // If a specific tenant is requested, verify access
  if (requestedTenantId) {
    if (!hasTenantAccess(user, requestedTenantId)) {
      throw new AuthorizationError(
        'Access denied: You do not have access to this tenant',
        'TENANT_ACCESS_DENIED'
      );
    }
    return { tenantId: requestedTenantId };
  }
  
  // Pick'd staff can access all tenants
  if (user.isPickdStaff) {
    // Return empty object to not filter by tenant
    // This requires special handling in the query
    throw new AuthorizationError(
      'Tenant ID required for non-admin queries',
      'TENANT_REQUIRED'
    );
  }
  
  // Filter by user's tenant access
  return { tenantId: { in: user.tenantAccess } };
}

export default {
  authorize,
  authorizePickdAdmin,
  hasPermission,
  hasTenantAccess,
  hasOrganizationAccess,
  isPickdStaff,
  isAdminOnlyResource,
  getAccessibleResources,
  filterTenantAccess,
  buildTenantWhereClause,
  AuthorizationError,
};
