/**
 * Database Client (Prisma)
 * 
 * This module exports a singleton Prisma client instance for use
 * throughout the application. It handles connection pooling and
 * prevents multiple client instances in development.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pool: Pool | undefined;
}

/**
 * Get or create a PostgreSQL connection pool
 */
function getPool(): Pool {
  if (!globalThis.pool) {
    globalThis.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalThis.pool;
}

/**
 * Create a new Prisma client with PostgreSQL adapter
 */
function createPrismaClient(): PrismaClient {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
  });
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
  logger.debug('Prisma client initialized with PostgreSQL adapter');
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
