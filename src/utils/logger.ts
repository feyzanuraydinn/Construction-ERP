// Simple logging utility for the application

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

// In-memory log buffer for recent logs
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current minimum log level (can be configured)
let minLogLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLogLevel];
}

function formatMessage(level: LogLevel, message: string, context?: string): string {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : '';
  return `${timestamp} [${level.toUpperCase()}]${prefix} ${message}`;
}

function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };
}

export const logger = {
  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    minLogLevel = level;
  },

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('debug')) return;

    const entry = createLogEntry('debug', message, context, data);
    addToBuffer(entry);

    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', message, context), data ?? '');
    }
  },

  /**
   * Log informational messages
   */
  info(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('info')) return;

    const entry = createLogEntry('info', message, context, data);
    addToBuffer(entry);

    console.info(formatMessage('info', message, context), data ?? '');
  },

  /**
   * Log warning messages
   */
  warn(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('warn')) return;

    const entry = createLogEntry('warn', message, context, data);
    addToBuffer(entry);

    console.warn(formatMessage('warn', message, context), data ?? '');
  },

  /**
   * Log error messages
   */
  error(message: string, context?: string, error?: Error | unknown): void {
    if (!shouldLog('error')) return;

    const entry = createLogEntry('error', message, context, error);
    addToBuffer(entry);

    console.error(formatMessage('error', message, context));
    if (error) {
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      } else {
        console.error('Error data:', error);
      }
    }
  },

  /**
   * Log performance timing
   */
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed in ${duration.toFixed(2)}ms`, 'Performance');
    };
  },

  /**
   * Get recent logs from buffer
   */
  getRecentLogs(count?: number): LogEntry[] {
    const n = count ?? LOG_BUFFER_SIZE;
    return logBuffer.slice(-n);
  },

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    logBuffer.length = 0;
  },

  /**
   * Create a logger with a specific context
   */
  createContextLogger(context: string) {
    return {
      debug: (message: string, data?: unknown) => logger.debug(message, context, data),
      info: (message: string, data?: unknown) => logger.info(message, context, data),
      warn: (message: string, data?: unknown) => logger.warn(message, context, data),
      error: (message: string, error?: Error | unknown) => logger.error(message, context, error),
      time: (label: string) => logger.time(`[${context}] ${label}`),
    };
  },
};

// Create context-specific loggers
export const dbLogger = logger.createContextLogger('Database');
export const apiLogger = logger.createContextLogger('API');
export const uiLogger = logger.createContextLogger('UI');
export const authLogger = logger.createContextLogger('Auth');

// Export default logger
export default logger;
