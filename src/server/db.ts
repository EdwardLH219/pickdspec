/**
 * Database Client (Prisma)
 * 
 * Singleton Prisma client instance for database operations.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client instance
 */
export const db = globalThis.prisma ?? new PrismaClient();

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
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
