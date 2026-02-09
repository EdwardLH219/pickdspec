/**
 * Audit Log Service
 * 
 * Production-grade audit logging for tracking all admin actions.
 * Records who did what, when, and captures before/after states.
 */

import { db } from '@/server/db';
import { AuditAction, UserRole } from '@prisma/client';
import { loggers } from '@/lib/logger';
import { headers } from 'next/headers';
import type { SessionUser } from '@/lib/auth/types';

const auditLogger = loggers.api.child({ service: 'audit' });

/**
 * Audit log entry input
 */
export interface AuditLogInput {
  /** The user performing the action */
  actor: SessionUser;
  /** What action was performed */
  action: AuditAction;
  /** Type of resource affected (e.g., 'ParameterSetVersion', 'RuleSetVersion', 'ScoreRun') */
  resourceType: string;
  /** ID of the affected resource */
  resourceId?: string;
  /** Tenant context if applicable */
  tenantId?: string;
  /** Organization context if applicable */
  organizationId?: string;
  /** State before the change (for updates/deletes) */
  oldValue?: Record<string, unknown>;
  /** State after the change (for creates/updates) */
  newValue?: Record<string, unknown>;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extract request context from headers
 */
async function getRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}> {
  try {
    const headersList = await headers();
    return {
      ipAddress: headersList.get('x-forwarded-for')?.split(',')[0]?.trim() 
        ?? headersList.get('x-real-ip') 
        ?? null,
      userAgent: headersList.get('user-agent'),
      requestId: headersList.get('x-request-id') ?? crypto.randomUUID(),
    };
  } catch {
    // Headers may not be available in some contexts
    return {
      ipAddress: null,
      userAgent: null,
      requestId: crypto.randomUUID(),
    };
  }
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<string> {
  const requestContext = await getRequestContext();
  
  try {
    const auditLog = await db.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        actorRole: input.actor.role as UserRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        tenantId: input.tenantId,
        organizationId: input.organizationId ?? input.actor.organizationId,
        oldValue: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : undefined,
        newValue: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : undefined,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        requestId: requestContext.requestId,
      },
    });

    auditLogger.info({
      auditLogId: auditLog.id,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorEmail: input.actor.email,
      requestId: requestContext.requestId,
    }, `Audit: ${input.action} ${input.resourceType}`);

    return auditLog.id;
  } catch (error) {
    // Log but don't throw - audit failures shouldn't break operations
    auditLogger.error({
      error,
      input: {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actorEmail: input.actor.email,
      },
    }, 'Failed to create audit log entry');
    
    return '';
  }
}

/**
 * Create multiple audit log entries in a batch
 */
export async function createAuditLogBatch(inputs: AuditLogInput[]): Promise<number> {
  const requestContext = await getRequestContext();
  
  try {
    const result = await db.auditLog.createMany({
      data: inputs.map(input => ({
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        actorRole: input.actor.role as UserRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        tenantId: input.tenantId,
        organizationId: input.organizationId ?? input.actor.organizationId,
        oldValue: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : undefined,
        newValue: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : undefined,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        requestId: requestContext.requestId,
      })),
    });

    auditLogger.info({
      count: result.count,
      requestId: requestContext.requestId,
    }, `Audit batch: created ${result.count} entries`);

    return result.count;
  } catch (error) {
    auditLogger.error({ error }, 'Failed to create audit log batch');
    return 0;
  }
}

/**
 * Helper to sanitize sensitive data from audit logs
 * Removes passwords, tokens, etc.
 */
export function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
    'apiKey', 'secret', 'credentials', 'externalConfig',
  ];
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Audit action helpers for common operations
 */
export const audit = {
  /**
   * Log a parameter version publish
   */
  async parameterPublished(
    actor: SessionUser,
    versionId: string,
    versionName: string,
    previousVersionId?: string,
    changelog?: Array<{ path: string; oldValue: unknown; newValue: unknown }>
  ) {
    return createAuditLog({
      actor,
      action: 'ACTIVATE',
      resourceType: 'ParameterSetVersion',
      resourceId: versionId,
      metadata: {
        versionName,
        previousVersionId,
        changeCount: changelog?.length ?? 0,
        changelog: changelog?.slice(0, 20), // Limit changelog size
      },
    });
  },

  /**
   * Log a parameter version creation
   */
  async parameterCreated(
    actor: SessionUser,
    versionId: string,
    versionName: string,
    baseOnVersionId?: string
  ) {
    return createAuditLog({
      actor,
      action: 'CREATE',
      resourceType: 'ParameterSetVersion',
      resourceId: versionId,
      metadata: {
        versionName,
        baseOnVersionId,
      },
    });
  },

  /**
   * Log a rule set version publish
   */
  async ruleSetPublished(
    actor: SessionUser,
    versionId: string,
    versionName: string,
    ruleSetId: string,
    previousVersionId?: string
  ) {
    return createAuditLog({
      actor,
      action: 'ACTIVATE',
      resourceType: 'RuleSetVersion',
      resourceId: versionId,
      metadata: {
        versionName,
        ruleSetId,
        previousVersionId,
      },
    });
  },

  /**
   * Log a rule set version creation
   */
  async ruleSetCreated(
    actor: SessionUser,
    versionId: string,
    versionName: string,
    ruleSetId: string,
    ruleCount?: { confidence: number; sufficiency: number }
  ) {
    return createAuditLog({
      actor,
      action: 'CREATE',
      resourceType: 'RuleSetVersion',
      resourceId: versionId,
      metadata: {
        versionName,
        ruleSetId,
        ruleCount,
      },
    });
  },

  /**
   * Log a score run triggered
   */
  async scoreRunTriggered(
    actor: SessionUser,
    tenantId: string,
    jobId: string,
    config: {
      periodStart: Date;
      periodEnd: Date;
      parameterVersionId?: string;
      ruleSetVersionId?: string;
      computeFixScores?: boolean;
    }
  ) {
    return createAuditLog({
      actor,
      action: 'TRIGGER',
      resourceType: 'ScoreRun',
      resourceId: jobId,
      tenantId,
      metadata: {
        periodStart: config.periodStart.toISOString(),
        periodEnd: config.periodEnd.toISOString(),
        parameterVersionId: config.parameterVersionId ?? 'active',
        ruleSetVersionId: config.ruleSetVersionId ?? 'active',
        computeFixScores: config.computeFixScores ?? true,
      },
    });
  },

  /**
   * Log a connector creation
   */
  async connectorCreated(
    actor: SessionUser,
    connectorId: string,
    tenantId: string,
    sourceType: string,
    name: string
  ) {
    return createAuditLog({
      actor,
      action: 'CREATE',
      resourceType: 'Connector',
      resourceId: connectorId,
      tenantId,
      metadata: {
        sourceType,
        name,
      },
    });
  },

  /**
   * Log a connector update
   */
  async connectorUpdated(
    actor: SessionUser,
    connectorId: string,
    tenantId: string,
    updates: string[]
  ) {
    return createAuditLog({
      actor,
      action: 'UPDATE',
      resourceType: 'Connector',
      resourceId: connectorId,
      tenantId,
      metadata: {
        updatedFields: updates,
      },
    });
  },

  /**
   * Log a connector deletion
   */
  async connectorDeleted(
    actor: SessionUser,
    connectorId: string,
    tenantId: string,
    sourceType: string,
    name: string
  ) {
    return createAuditLog({
      actor,
      action: 'DELETE',
      resourceType: 'Connector',
      resourceId: connectorId,
      tenantId,
      oldValue: {
        sourceType,
        name,
      },
    });
  },

  /**
   * Log user login
   */
  async userLogin(actor: SessionUser) {
    return createAuditLog({
      actor,
      action: 'LOGIN',
      resourceType: 'Session',
      resourceId: actor.id,
    });
  },

  /**
   * Log user logout
   */
  async userLogout(actor: SessionUser) {
    return createAuditLog({
      actor,
      action: 'LOGOUT',
      resourceType: 'Session',
      resourceId: actor.id,
    });
  },

  /**
   * Log data export
   */
  async dataExported(
    actor: SessionUser,
    resourceType: string,
    tenantId: string,
    exportFormat: string,
    recordCount: number
  ) {
    return createAuditLog({
      actor,
      action: 'EXPORT',
      resourceType,
      tenantId,
      metadata: {
        exportFormat,
        recordCount,
      },
    });
  },
};

export default audit;
