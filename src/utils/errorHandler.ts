/**
 * Centralized Error Handling Utilities
 *
 * Provides standardized error types and handling for the application.
 * All errors should be processed through these utilities for consistent
 * error reporting and user feedback.
 *
 * @module errorHandler
 */

import { logger } from './logger';

/**
 * Application error codes for categorizing errors
 */
export enum ErrorCode {
  // Database errors (1xx)
  DB_CONNECTION_FAILED = 'E100',
  DB_QUERY_FAILED = 'E101',
  DB_VALIDATION_FAILED = 'E102',
  DB_NOT_FOUND = 'E103',
  DB_CONSTRAINT_VIOLATION = 'E104',

  // Network errors (2xx)
  NETWORK_OFFLINE = 'E200',
  NETWORK_TIMEOUT = 'E201',
  API_ERROR = 'E202',
  API_RATE_LIMITED = 'E203',

  // File system errors (3xx)
  FILE_NOT_FOUND = 'E300',
  FILE_ACCESS_DENIED = 'E301',
  FILE_WRITE_FAILED = 'E302',
  FILE_READ_FAILED = 'E303',

  // Validation errors (4xx)
  VALIDATION_FAILED = 'E400',
  INVALID_INPUT = 'E401',
  MISSING_REQUIRED_FIELD = 'E402',

  // Authentication errors (5xx)
  AUTH_FAILED = 'E500',
  AUTH_EXPIRED = 'E501',
  AUTH_INVALID_CREDENTIALS = 'E502',

  // General errors (9xx)
  UNKNOWN_ERROR = 'E999',
}

/**
 * User-friendly error messages in Turkish
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.DB_CONNECTION_FAILED]: 'Veritabanı bağlantısı kurulamadı',
  [ErrorCode.DB_QUERY_FAILED]: 'Veritabanı işlemi başarısız oldu',
  [ErrorCode.DB_VALIDATION_FAILED]: 'Veri doğrulaması başarısız',
  [ErrorCode.DB_NOT_FOUND]: 'Kayıt bulunamadı',
  [ErrorCode.DB_CONSTRAINT_VIOLATION]: 'Bu işlem mevcut verilerle çakışıyor',

  [ErrorCode.NETWORK_OFFLINE]: 'İnternet bağlantısı yok',
  [ErrorCode.NETWORK_TIMEOUT]: 'Bağlantı zaman aşımına uğradı',
  [ErrorCode.API_ERROR]: 'Sunucu hatası oluştu',
  [ErrorCode.API_RATE_LIMITED]: 'Çok fazla istek gönderildi, lütfen bekleyin',

  [ErrorCode.FILE_NOT_FOUND]: 'Dosya bulunamadı',
  [ErrorCode.FILE_ACCESS_DENIED]: 'Dosyaya erişim reddedildi',
  [ErrorCode.FILE_WRITE_FAILED]: 'Dosya yazılamadı',
  [ErrorCode.FILE_READ_FAILED]: 'Dosya okunamadı',

  [ErrorCode.VALIDATION_FAILED]: 'Girilen veriler geçersiz',
  [ErrorCode.INVALID_INPUT]: 'Geçersiz giriş',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Zorunlu alan boş bırakılamaz',

  [ErrorCode.AUTH_FAILED]: 'Kimlik doğrulama başarısız',
  [ErrorCode.AUTH_EXPIRED]: 'Oturum süresi doldu',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Geçersiz kimlik bilgileri',

  [ErrorCode.UNKNOWN_ERROR]: 'Beklenmeyen bir hata oluştu',
};

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly originalError?: Error;
  public readonly context?: string;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    options?: {
      message?: string;
      userMessage?: string;
      originalError?: Error;
      context?: string;
    }
  ) {
    const defaultMessage = ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
    super(options?.message || defaultMessage);

    this.name = 'AppError';
    this.code = code;
    this.userMessage = options?.userMessage || defaultMessage;
    this.originalError = options?.originalError;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Error handler result type
 */
export interface ErrorHandlerResult {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    userMessage: string;
  };
}

/**
 * Success handler result type
 */
export interface SuccessResult<T> {
  success: true;
  data: T;
}

/**
 * Combined result type for operations
 */
export type OperationResult<T> = SuccessResult<T> | ErrorHandlerResult;

/**
 * Create a success result
 */
export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
export function failure(
  code: ErrorCode,
  options?: { message?: string; userMessage?: string }
): ErrorHandlerResult {
  const defaultMessage = ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
  return {
    success: false,
    error: {
      code,
      message: options?.message || defaultMessage,
      userMessage: options?.userMessage || defaultMessage,
    },
  };
}

/**
 * Handle and log an error
 *
 * @param error - The error to handle
 * @param context - Context where the error occurred
 * @returns AppError instance
 */
export function handleError(error: unknown, context?: string): AppError {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    // Map common error types to AppError
    const code = mapErrorToCode(error);
    appError = new AppError(code, {
      message: error.message,
      originalError: error,
      context,
    });
  } else {
    // Handle non-Error objects
    appError = new AppError(ErrorCode.UNKNOWN_ERROR, {
      message: String(error),
      context,
    });
  }

  // Log the error
  logger.error(appError.message, context || appError.context, appError.originalError || appError);

  return appError;
}

/**
 * Map native errors to error codes
 */
function mapErrorToCode(error: Error): ErrorCode {
  const message = error.message.toLowerCase();

  // Database errors
  if (message.includes('sqlite') || message.includes('database')) {
    if (message.includes('constraint')) {
      return ErrorCode.DB_CONSTRAINT_VIOLATION;
    }
    if (message.includes('not found')) {
      return ErrorCode.DB_NOT_FOUND;
    }
    return ErrorCode.DB_QUERY_FAILED;
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    if (message.includes('timeout')) {
      return ErrorCode.NETWORK_TIMEOUT;
    }
    return ErrorCode.NETWORK_OFFLINE;
  }

  // File system errors
  if (message.includes('enoent') || message.includes('file not found')) {
    return ErrorCode.FILE_NOT_FOUND;
  }
  if (message.includes('eacces') || message.includes('permission denied')) {
    return ErrorCode.FILE_ACCESS_DENIED;
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCode.VALIDATION_FAILED;
  }

  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Wrap an async function with error handling
 *
 * @param fn - The async function to wrap
 * @param context - Context for error logging
 * @returns Wrapped function that returns OperationResult
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context?: string
): (...args: Args) => Promise<OperationResult<T>> {
  return async (...args: Args): Promise<OperationResult<T>> => {
    try {
      const result = await fn(...args);
      return success(result);
    } catch (error) {
      const appError = handleError(error, context);
      return failure(appError.code, {
        message: appError.message,
        userMessage: appError.userMessage,
      });
    }
  };
}

/**
 * Try-catch wrapper for sync operations
 *
 * @param fn - The function to wrap
 * @param context - Context for error logging
 * @returns Result or error
 */
export function tryCatch<T>(fn: () => T, context?: string): OperationResult<T> {
  try {
    const result = fn();
    return success(result);
  } catch (error) {
    const appError = handleError(error, context);
    return failure(appError.code, {
      message: appError.message,
      userMessage: appError.userMessage,
    });
  }
}

/**
 * Assert a condition and throw AppError if false
 *
 * @param condition - Condition to check
 * @param code - Error code if condition is false
 * @param message - Optional error message
 */
export function assert(condition: boolean, code: ErrorCode, message?: string): asserts condition {
  if (!condition) {
    throw new AppError(code, { message });
  }
}

/**
 * Assert a value is not null/undefined
 *
 * @param value - Value to check
 * @param code - Error code if value is null/undefined
 * @param message - Optional error message
 */
export function assertDefined<T>(
  value: T | null | undefined,
  code: ErrorCode = ErrorCode.DB_NOT_FOUND,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new AppError(code, { message: message || 'Value is not defined' });
  }
}

export default {
  AppError,
  ErrorCode,
  ERROR_MESSAGES,
  handleError,
  withErrorHandling,
  tryCatch,
  success,
  failure,
  assert,
  assertDefined,
};
