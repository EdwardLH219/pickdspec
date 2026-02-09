/**
 * Liveness Probe Endpoint
 * 
 * Simple endpoint to check if the server process is alive.
 * Used by orchestrators (K8s, Docker) to detect hung processes.
 * 
 * Should always return 200 if the process is running.
 * Does NOT check external dependencies.
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/health/live
 * 
 * Liveness probe - returns 200 if process is alive.
 * Fast, no external dependencies checked.
 */
export async function GET() {
  return NextResponse.json(
    { 
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
