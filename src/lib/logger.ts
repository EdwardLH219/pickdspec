/**
 * Logging Utility with Pino
 * 
 * Centralized logging for the Pick'd application.
 * Uses Pino for high-performance structured logging.
 */

import pino, { Logger, LoggerOptions } from 'pino';

/**
 * Log levels available
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Determine the log level from environment
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  
  if (envLevel && ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(envLevel)) {
    return envLevel;
  }
  
  // Default to 'debug' in development, 'info' in production
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Determine if we should use pretty printing
 */
function shouldPrettyPrint(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Create the base logger configuration
 */
function createLoggerOptions(): LoggerOptions {
  const isDev = process.env.NODE_ENV !== 'production';
  
  const baseOptions: LoggerOptions = {
    level: getLogLevel(),
    base: {
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  // In development, use pino-pretty for readable output
  if (isDev) {
    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,env',
        },
      },
    };
  }

  return baseOptions;
}

/**
 * The main logger instance
 */
export const logger: Logger = pino(createLoggerOptions());

/**
 * Create a child logger with additional context
 * 
 * @example
 * const authLogger = createChildLogger({ module: 'auth' });
 * authLogger.info('User logged in', { userId: '123' });
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/**
 * Pre-configured loggers for different modules
 */
export const loggers = {
  /** Authentication-related logging */
  auth: createChildLogger({ module: 'auth' }),
  
  /** Database operations */
  db: createChildLogger({ module: 'db' }),
  
  /** API route handlers */
  api: createChildLogger({ module: 'api' }),
  
  /** Background jobs/workers */
  worker: createChildLogger({ module: 'worker' }),
  
  /** External service integrations */
  external: createChildLogger({ module: 'external' }),
  
  /** Scoring engine */
  scoring: createChildLogger({ module: 'scoring' }),
};

/**
 * Log an error with stack trace
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error({
    err: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    ...context,
  }, error.message);
}

/**
 * Log a request (useful for API routes)
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger[level]({
    method,
    path,
    statusCode,
    durationMs,
    ...context,
  }, `${method} ${path} ${statusCode} ${durationMs}ms`);
}

/**
 * Performance timing helper
 * 
 * @example
 * const timer = startTimer();
 * await doSomething();
 * timer.done({ operation: 'doSomething' });
 */
export function startTimer(): { done: (context?: Record<string, unknown>) => number } {
  const start = performance.now();
  
  return {
    done: (context?: Record<string, unknown>) => {
      const duration = performance.now() - start;
      logger.debug({
        durationMs: Math.round(duration * 100) / 100,
        ...context,
      }, `Timer completed in ${duration.toFixed(2)}ms`);
      return duration;
    },
  };
}

export default logger;
