import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCode,
  ValidationError,
  DatabaseError,
  NetworkError,
  FileError,
  categorizeError,
  withRetry,
} from '../utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError({ message: 'Test error' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.retryable).toBe(false);
    });

    it('should create an error with custom code', () => {
      const error = new AppError({
        message: 'Database failed',
        code: ErrorCode.DATABASE_ERROR,
      });
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('should serialize to JSON', () => {
      const error = new AppError({
        message: 'Test',
        code: ErrorCode.VALIDATION_ERROR,
        retryable: false,
      });
      const json = error.toJSON();
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.message).toBe('Test');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.userMessage).toBe('Invalid input');
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error', () => {
      const originalError = new Error('SQLITE_CONSTRAINT');
      const error = new DatabaseError('Failed to insert', originalError);
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('NetworkError', () => {
    it('should be retryable by default', () => {
      const error = new NetworkError('Connection failed');
      expect(error.retryable).toBe(true);
    });

    it('should allow setting retryable to false', () => {
      const error = new NetworkError('Auth failed', undefined, false);
      expect(error.retryable).toBe(false);
    });
  });

  describe('categorizeError', () => {
    it('should return AppError as-is', () => {
      const error = new ValidationError('Test');
      const categorized = categorizeError(error);
      expect(categorized).toBe(error);
    });

    it('should categorize SQLite errors as DatabaseError', () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      const categorized = categorizeError(error);
      expect(categorized).toBeInstanceOf(DatabaseError);
    });

    it('should categorize network errors', () => {
      const error = new Error('fetch failed: ECONNREFUSED');
      const categorized = categorizeError(error);
      expect(categorized).toBeInstanceOf(NetworkError);
    });

    it('should categorize file errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const categorized = categorizeError(error);
      expect(categorized).toBeInstanceOf(FileError);
    });

    it('should handle string errors', () => {
      const categorized = categorizeError('Something went wrong');
      expect(categorized).toBeInstanceOf(AppError);
      expect(categorized.message).toBe('Something went wrong');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return 'success';
      };

      const result = await withRetry(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Connection failed');
        }
        return 'success';
      };

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10, // Fast for testing
      });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const fn = async () => {
        throw new NetworkError('Always fails');
      };

      await expect(withRetry(fn, { maxRetries: 2, initialDelay: 10 })).rejects.toThrow(
        'Always fails'
      );
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new ValidationError('Invalid data');
      };

      await expect(withRetry(fn, { maxRetries: 3, initialDelay: 10 })).rejects.toThrow(
        'Invalid data'
      );
      expect(attempts).toBe(1);
    });
  });
});
