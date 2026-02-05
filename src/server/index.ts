/**
 * Server Module Exports
 * 
 * Central export point for all server-side utilities.
 */

// Database
export { db, checkDbConnection, disconnectDb } from './db';

// RBAC Authorization
export {
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
} from './auth/rbac';

// Re-export types
export type { Resource, Action, SessionUser } from '@/lib/auth/types';
