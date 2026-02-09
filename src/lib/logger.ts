/**
 * Logging Utility with Pino
 * 
 * Centralized logging for the Pick'd application.
 * Uses Pino for high-performance structured logging.
 * Includes error reporting hooks for external services (Sentry, etc.)
 */

import pino, { Logger, LoggerOptions } from 'pino';

/**
 * Log levels available
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Error context for reporting
 */
export interface ErrorContext {
  error: Error;
  level: 'error' | 'fatal';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
}

/**
 * Error reporter interface for external services
 */
export interface ErrorReporter {
  /** Called when an error is logged */
  captureError(context: ErrorContext): void | Promise<void>;
  /** Called when a message needs to be captured */
  captureMessage?(message: string, level: string): void | Promise<void>;
}

/**
 * Registry of error reporters
 */
const errorReporters: ErrorReporter[] = [];

/**
 * Register an error reporter (Sentry, Datadog, etc.)
 * 
 * @example
 * // Sentry integration
 * registerErrorReporter({
 *   captureError: (ctx) => Sentry.captureException(ctx.error, { extra: ctx.context }),
 *   captureMessage: (msg, level) => Sentry.captureMessage(msg, level),
 * });
 */
export function registerErrorReporter(reporter: ErrorReporter): void {
  errorReporters.push(reporter);
}

/**
 * Report an error to all registered reporters
 */
async function reportError(context: ErrorContext): Promise<void> {
  for (const reporter of errorReporters) {
    try {
      await reporter.captureError(context);
    } catch (e) {
      // Don't let reporter errors break the application
      console.error('Error reporter failed:', e);
    }
  }
}

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
      service: 'pickd-web',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Custom hook to intercept errors and report them
    hooks: {
      logMethod(inputArgs, method, level) {
        // Intercept error and fatal logs for external reporting
        if (level >= 50) { // error = 50, fatal = 60
          const levelName = level === 60 ? 'fatal' : 'error';
          const [obj, msg] = inputArgs;
          
          if (obj && typeof obj === 'object' && 'err' in obj) {
            const errObj = obj as { err?: Error; requestId?: string; userId?: string; tenantId?: string };
            if (errObj.err instanceof Error) {
              reportError({
                error: errObj.err,
                level: levelName,
                message: msg ?? errObj.err.message,
                context: obj as Record<string, unknown>,
                timestamp: new Date().toISOString(),
                requestId: errObj.requestId,
                userId: errObj.userId,
                tenantId: errObj.tenantId,
              });
            }
          }
        }
        return method.apply(this, inputArgs);
      },
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
          ignore: 'pid,hostname,env,service',
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
 * Automatically reports to external error trackers
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error({
    err: error,
    ...context,
  }, error.message);
}

/**
 * Log a fatal error (application cannot continue)
 */
export function logFatal(error: Error, context?: Record<string, unknown>): void {
  logger.fatal({
    err: error,
    ...context,
  }, error.message);
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(requestId: string, metadata?: Record<string, unknown>): Logger {
  return logger.child({
    requestId,
    ...metadata,
  });
}

/**
 * Structured API error response with logging
 */
export function logApiError(
  error: Error | unknown,
  context: {
    path: string;
    method: string;
    statusCode: number;
    userId?: string;
    tenantId?: string;
    requestId?: string;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  
  logger.error({
    err,
    ...context,
  }, `API Error: ${context.method} ${context.path} ${context.statusCode}`);
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
