/**
 * Environment Variable Validation with Zod
 * 
 * All environment variables are validated at startup to ensure
 * the application has all required configuration.
 */

import { z } from 'zod';

/**
 * Server-side environment variables schema
 */
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Application
  APP_URL: z.string().url().default('http://localhost:3000'),
  
  // Authentication
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Redis (for BullMQ)
  REDIS_URL: z.string().url().optional(),
  
  // OpenAI (for sentiment analysis)
  OPENAI_API_KEY: z.string().optional(),
  
  // External APIs
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  HELLOPETER_API_KEY: z.string().optional(),
  
  // Email (Resend or SMTP)
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Client-side environment variables schema (exposed via NEXT_PUBLIC_ prefix)
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
});

/**
 * Combined environment schema
 */
const envSchema = serverEnvSchema.merge(clientEnvSchema);

export type Env = z.infer<typeof envSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Parsed and validated environment variables
 * 
 * This function validates all environment variables at runtime.
 * Call this during application startup to fail fast if configuration is invalid.
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

/**
 * Get a single environment variable with validation
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const value = process.env[key];
  const schema = envSchema.shape[key];
  
  if (!schema) {
    throw new Error(`Unknown environment variable: ${key}`);
  }
  
  const parsed = schema.safeParse(value);
  
  if (!parsed.success) {
    throw new Error(`Invalid environment variable ${key}: ${parsed.error.message}`);
  }
  
  return parsed.data as Env[K];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Validated environment variables
 * 
 * Import this to access type-safe environment variables:
 * 
 * ```ts
 * import { env } from '@/lib/env';
 * console.log(env.DATABASE_URL);
 * ```
 */
export const env = validateEnv();

export default env;
