/**
 * Custom Error Classes for better error categorization
 */

export enum ErrorCode {
  // Validation Errors (1xxx)
  VALIDATION_ERROR = 1000,
  INVALID_INPUT = 1001,
  MISSING_REQUIRED_FIELD = 1002,
  INVALID_FORMAT = 1003,

  // Database Errors (2xxx)
  DATABASE_ERROR = 2000,
  DATABASE_CONNECTION = 2001,
  DATABASE_QUERY = 2002,
  DATABASE_CONSTRAINT = 2003,
  DATABASE_MIGRATION = 2004,
  DATABASE_INTEGRITY = 2005,

  // Network Errors (3xxx)
  NETWORK_ERROR = 3000,
  NETWORK_TIMEOUT = 3001,
  NETWORK_OFFLINE = 3002,
  API_ERROR = 3003,
  RATE_LIMIT = 3004,

  // File System Errors (4xxx)
  FILE_ERROR = 4000,
  FILE_NOT_FOUND = 4001,
  FILE_PERMISSION = 4002,
  FILE_CORRUPT = 4003,
  BACKUP_ERROR = 4004,

  // Auth Errors (5xxx)
  AUTH_ERROR = 5000,
  AUTH_INVALID_CREDENTIALS = 5001,
  AUTH_EXPIRED = 5002,
  AUTH_PERMISSION_DENIED = 5003,

  // Business Logic Errors (6xxx)
  BUSINESS_ERROR = 6000,
  DUPLICATE_ENTRY = 6001,
  DEPENDENCY_EXISTS = 6002,
  INVALID_STATE = 6003,

  // Unknown Error
  UNKNOWN_ERROR = 9999,
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: Error;
  retryable: boolean;
  userMessage: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(options: Partial<ErrorDetails> & { message: string }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code ?? ErrorCode.UNKNOWN_ERROR;
    this.details = options.details;
    this.originalError = options.originalError;
    this.retryable = options.retryable ?? false;
    this.userMessage = options.userMessage ?? this.getDefaultUserMessage();
  }

  private getDefaultUserMessage(): string {
    const category = Math.floor(this.code / 1000);
    switch (category) {
      case 1:
        return 'Girilen veriler geçersiz. Lütfen kontrol edip tekrar deneyin.';
      case 2:
        return 'Veritabanı işlemi sırasında bir hata oluştu.';
      case 3:
        return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
      case 4:
        return 'Dosya işlemi sırasında bir hata oluştu.';
      case 5:
        return 'Kimlik doğrulama hatası.';
      case 6:
        return 'İşlem gerçekleştirilemedi.';
      default:
        return 'Beklenmeyen bir hata oluştu.';
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      userMessage: this.userMessage,
    };
  }
}

// Specialized Error Classes
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: ErrorCode.VALIDATION_ERROR,
      details,
      retryable: false,
      userMessage: message,
    });
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error, code: ErrorCode = ErrorCode.DATABASE_ERROR) {
    super({
      message,
      code,
      originalError,
      retryable: false,
      userMessage: 'Veritabanı işlemi başarısız oldu.',
    });
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, originalError?: Error, retryable = true) {
    super({
      message,
      code: ErrorCode.NETWORK_ERROR,
      originalError,
      retryable,
      userMessage: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    });
    this.name = 'NetworkError';
  }
}

export class FileError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.FILE_ERROR, originalError?: Error) {
    super({
      message,
      code,
      originalError,
      retryable: false,
      userMessage: 'Dosya işlemi başarısız oldu.',
    });
    this.name = 'FileError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.AUTH_ERROR) {
    super({
      message,
      code,
      retryable: false,
      userMessage: 'Kimlik doğrulama başarısız.',
    });
    this.name = 'AuthError';
  }
}

export class BusinessError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.BUSINESS_ERROR,
    details?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      details,
      retryable: false,
      userMessage: message,
    });
    this.name = 'BusinessError';
  }
}

/**
 * Categorize an unknown error into an AppError
 */
export function categorizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Database errors
    if (message.includes('sqlite') || message.includes('database') || message.includes('sql')) {
      return new DatabaseError(error.message, error);
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('econnrefused')
    ) {
      return new NetworkError(error.message, error);
    }

    // File errors
    if (
      message.includes('enoent') ||
      message.includes('file') ||
      message.includes('permission denied')
    ) {
      return new FileError(error.message, ErrorCode.FILE_ERROR, error);
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return new ValidationError(error.message);
    }

    // Generic error
    return new AppError({
      message: error.message,
      originalError: error,
      retryable: false,
    });
  }

  // Unknown error type
  return new AppError({
    message: String(error),
    retryable: false,
  });
}

/**
 * Error handler for IPC calls
 */
export function handleIPCError(error: unknown): never {
  const appError = categorizeError(error);
  console.error(`[${appError.code}] ${appError.name}: ${appError.message}`);
  throw appError;
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (err) => {
      const appError = categorizeError(err);
      return appError.retryable;
    },
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}
