/**
 * File-based Logger for Electron Main Process
 *
 * Features:
 * - Writes logs to files in the app data directory
 * - Automatic log rotation based on file size
 * - Console output (optional)
 * - Multiple log levels (debug, info, warn, error)
 *
 * @module logger
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { LIMITS } from '../utils/constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  /** Minimum log level to record */
  level: LogLevel;
  /** Maximum log file size in bytes before rotation */
  maxFileSize: number;
  /** Maximum number of rotated log files to keep */
  maxFiles: number;
  /** Whether to also output logs to console */
  logToConsole: boolean;
}

// Default configuration
const DEFAULT_CONFIG: LogConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  maxFileSize: LIMITS.MAX_LOG_FILE_SIZE,
  maxFiles: LIMITS.MAX_LOG_FILES,
  logToConsole: true,
};

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class FileLogger {
  private config: LogConfig;
  private logDir: string;
  private currentLogFile: string;
  private writeStream: fs.WriteStream | null = null;
  private initialized = false;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logDir = '';
    this.currentLogFile = '';
  }

  /**
   * Initialize the logger (must be called after app.ready)
   */
  init(): void {
    if (this.initialized) return;

    try {
      this.logDir = path.join(app.getPath('userData'), 'logs');

      // Create logs directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Set current log file
      this.currentLogFile = path.join(this.logDir, 'app.log');

      // Check if rotation is needed
      this.rotateIfNeeded();

      // Open write stream
      this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });

      this.initialized = true;
      this.info('Logger initialized', 'Logger');
    } catch (error) {
      console.error('Failed to initialize file logger:', error);
    }
  }

  /**
   * Rotate log files if current file exceeds max size
   */
  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.currentLogFile)) return;

      const stats = fs.statSync(this.currentLogFile);
      if (stats.size < this.config.maxFileSize) return;

      // Close current stream
      if (this.writeStream) {
        this.writeStream.close();
        this.writeStream = null;
      }

      // Rotate files
      for (let i = this.config.maxFiles - 1; i >= 0; i--) {
        const oldFile = i === 0 ? this.currentLogFile : path.join(this.logDir, `app.${i}.log`);
        const newFile = path.join(this.logDir, `app.${i + 1}.log`);

        if (fs.existsSync(oldFile)) {
          if (i === this.config.maxFiles - 1) {
            // Delete oldest file
            fs.unlinkSync(oldFile);
          } else {
            // Rename file
            fs.renameSync(oldFile, newFile);
          }
        }
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${contextStr}${message}\n`;
  }

  /**
   * Check if should log this level
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Write to log file
   */
  private write(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context);

    // Write to file
    if (this.writeStream) {
      this.writeStream.write(formatted);
      if (data !== undefined) {
        this.writeStream.write(`  Data: ${JSON.stringify(data)}\n`);
      }
    }

    // Write to console
    if (this.config.logToConsole) {
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'debug'
              ? console.debug
              : console.log;

      consoleFn(formatted.trim(), data !== undefined ? data : '');
    }

    // Check rotation after write
    this.rotateIfNeeded();
  }

  debug(message: string, context?: string, data?: unknown): void {
    this.write('debug', message, context, data);
  }

  info(message: string, context?: string, data?: unknown): void {
    this.write('info', message, context, data);
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.write('warn', message, context, data);
  }

  error(message: string, context?: string, error?: Error | unknown): void {
    this.write('error', message, context);
    if (error) {
      if (error instanceof Error) {
        this.write('error', `  ${error.name}: ${error.message}`, context);
        if (error.stack) {
          this.write('error', `  Stack: ${error.stack}`, context);
        }
      } else {
        this.write('error', `  Error data: ${JSON.stringify(error)}`, context);
      }
    }
  }

  /**
   * Log IPC call
   */
  ipc(channel: string, args?: unknown): void {
    this.debug(`IPC: ${channel}`, 'IPC', args);
  }

  /**
   * Log database operation
   */
  db(operation: string, details?: unknown): void {
    this.debug(`DB: ${operation}`, 'Database', details);
  }

  /**
   * Create a timed logger
   */
  time(label: string, context?: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed in ${duration}ms`, context);
    };
  }

  /**
   * Get log file path
   */
  getLogPath(): string {
    return this.currentLogFile;
  }

  /**
   * Get log directory
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Read recent logs from file
   */
  async getRecentLogs(lines = 100): Promise<string[]> {
    if (!fs.existsSync(this.currentLogFile)) {
      return [];
    }

    const content = await fs.promises.readFile(this.currentLogFile, 'utf-8');
    const allLines = content.split('\n').filter(Boolean);
    return allLines.slice(-lines);
  }

  /**
   * Close the logger
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.close();
      this.writeStream = null;
    }
    this.initialized = false;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Export singleton instance
export const mainLogger = new FileLogger();

// Export for direct use
export default mainLogger;
