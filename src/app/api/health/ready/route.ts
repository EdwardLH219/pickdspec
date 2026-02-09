/**
 * Readiness Probe Endpoint
 * 
 * Checks if the server is ready to accept traffic.
 * Verifies critical dependencies (database) are available.
 * 
 * Used by load balancers to determine if traffic should be routed here.
 */

import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { loggers } from '@/lib/logger';

const healthLogger = loggers.api.child({ service: 'health' });

/**
 * GET /api/health/ready
 * 
 * Readiness probe - returns 200 if ready to serve traffic.
 * Checks database connectivity.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Check database connectivity
    const dbStart = performance.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Math.round(performance.now() - dbStart);

    return NextResponse.json(
      { 
        status: 'ready',
        timestamp,
        checks: {
          database: {
            status: 'pass',
            latencyMs: dbLatency,
          },
        },
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    healthLogger.warn({ error }, 'Readiness check failed');

    return NextResponse.json(
      { 
        status: 'not_ready',
        timestamp,
        checks: {
          database: {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Database unavailable',
          },
        },
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
