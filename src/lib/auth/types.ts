/**
 * Authentication Types
 * 
 * Type definitions for authentication and authorization.
 */

import { UserRole } from '@prisma/client';

/**
 * User roles - mapped to Prisma enum
 */
export { UserRole };

/**
 * Session user with RBAC data
 */
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isPickdStaff: boolean;
  organizationId: string | null;
  tenantAccess: string[];
  image?: string | null;
}

/**
 * Extended session with user data
 */
export interface AppSession {
  user: SessionUser;
  expires: string;
}

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY = {
  PICKD_ADMIN: { level: 100, isPickdStaff: true },
  PICKD_SUPPORT: { level: 90, isPickdStaff: true },
  OWNER: { level: 50, isPickdStaff: false },
  MANAGER: { level: 40, isPickdStaff: false },
  STAFF: { level: 30, isPickdStaff: false },
} as const;

/**
 * Resources that can be accessed
 */
export type Resource =
  | 'parameter_sets'
  | 'score_runs'
  | 'audit_logs'
  | 'all_tenants'
  | 'dashboard'
  | 'reviews'
  | 'tasks'
  | 'reports'
  | 'recommendations'
  | 'users'
  | 'billing'
  | 'branches'
  | 'organization';

/**
 * Actions that can be performed
 */
export type Action = 'create' | 'read' | 'update' | 'delete';

/**
 * Route groups for middleware
 */
export type RouteGroup = 'portal' | 'admin' | 'public' | 'api';

/**
 * Roles allowed for each route group
 */
export const ROUTE_GROUP_ROLES: Record<RouteGroup, UserRole[]> = {
  portal: ['OWNER', 'MANAGER', 'STAFF', 'PICKD_ADMIN', 'PICKD_SUPPORT'],
  admin: ['PICKD_ADMIN'],
  public: [], // No auth required
  api: [], // Handled per-route
};

/**
 * Admin-only resources
 */
export const ADMIN_ONLY_RESOURCES: Resource[] = [
  'parameter_sets',
  'score_runs',
  'audit_logs',
  'all_tenants',
];
