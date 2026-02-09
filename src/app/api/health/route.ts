/**
 * Health Check Endpoints
 * 
 * Production-grade health checks for web server monitoring.
 * 
 * GET /api/health - Full health check with component status
 */

import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { loggers } from '@/lib/logger';

const healthLogger = loggers.api.child({ service: 'health' });

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    memory: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'pass' | 'warn' | 'fail';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

const startTime = Date.now();

/**
 * GET /api/health
 * 
 * Full health check with all component statuses.
 * Use this for detailed health monitoring.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: HealthStatus['checks'] = {
    database: { status: 'fail' },
    memory: { status: 'fail' },
  };

  // Database health check
  const dbStart = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'pass',
      responseTime: Math.round(performance.now() - dbStart),
    };
  } catch (error) {
    healthLogger.error({ error }, 'Database health check failed');
    checks.database = {
      status: 'fail',
      responseTime: Math.round(performance.now() - dbStart),
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }

  // Memory health check
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    checks.memory = {
      status: heapPercent > 90 ? 'warn' : 'pass',
      details: {
        heapUsedMB,
        heapTotalMB,
        heapPercent,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  } catch {
    checks.memory = {
      status: 'warn',
      message: 'Memory metrics unavailable',
    };
  }

  // Determine overall status
  const hasFailure = Object.values(checks).some(c => c.status === 'fail');
  const hasWarning = Object.values(checks).some(c => c.status === 'warn');

  const health: HealthStatus = {
    status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
    timestamp,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  };

  const statusCode = hasFailure ? 503 : 200;

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
