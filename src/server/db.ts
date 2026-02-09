/**
 * Database Client (Prisma)
 * 
 * This module exports a singleton Prisma client instance for use
 * throughout the application. Uses the pg adapter for Prisma 7+.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '@/lib/logger';

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: pg.Pool | undefined;
}

/**
 * Get or create a PostgreSQL connection pool
 */
function getPool(): pg.Pool {
  if (!globalThis.pgPool) {
    globalThis.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Maximum pool size
    });
  }
  return globalThis.pgPool;
}

/**
 * Create a new Prisma client with pg adapter (required for Prisma 7+)
 */
function createPrismaClient(): PrismaClient {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({ adapter });
}

/**
 * Singleton Prisma client instance
 * 
 * In development, we store the client on the global object to prevent
 * multiple instances being created during hot module replacement.
 */
export const db = globalThis.prisma ?? createPrismaClient();

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
  logger.debug('Prisma client initialized with pg adapter');
}

/**
 * Check database connection health
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection check failed');
    return false;
  }
}

/**
 * Gracefully disconnect from the database
 */
export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
  logger.info('Database connection closed');
}

export default db;
