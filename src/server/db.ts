/**
 * Database Client (Prisma)
 * 
 * This module exports a singleton Prisma client instance for use
 * throughout the application. It handles connection pooling and
 * prevents multiple client instances in development.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Create a new Prisma client
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
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
  logger.debug('Prisma client initialized');
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
