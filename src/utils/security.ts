/**
 * Security utilities for input sanitization and validation
 */

/**
 * Escape special characters for SQL LIKE queries
 * Prevents SQL injection through LIKE patterns
 */
export function escapeLikePattern(input: string): string {
  if (!input) return '';
  // Escape special LIKE characters: % _ [ ]
  return input
    .replace(/\\/g, '\\\\') // Escape backslash first
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Create a safe LIKE search pattern
 * @param input - User input to search for
 * @param position - Where to add wildcards: 'start', 'end', 'both', or 'exact'
 */
export function createSafeLikePattern(
  input: string,
  position: 'start' | 'end' | 'both' | 'exact' = 'both'
): string {
  const escaped = escapeLikePattern(input);
  switch (position) {
    case 'start':
      return `%${escaped}`;
    case 'end':
      return `${escaped}%`;
    case 'exact':
      return escaped;
    case 'both':
    default:
      return `%${escaped}%`;
  }
}

/**
 * Sanitize file path to prevent directory traversal attacks
 * @param basePath - The allowed base directory
 * @param userPath - User-provided path segment
 * @returns Safe path within base directory, or null if invalid
 */
export function sanitizeFilePath(basePath: string, userPath: string): string | null {
  if (!userPath) return null;

  // Remove any path traversal attempts
  const sanitized = userPath
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/^[/\\]+/, '') // Remove leading slashes
    .replace(/[/\\]+/g, '/') // Normalize slashes
    .replace(/[<>:"|?*]/g, ''); // Remove invalid characters

  // Check if the result is empty or just whitespace
  if (!sanitized.trim()) return null;

  return sanitized;
}

/**
 * Validate and sanitize backup file path
 * Ensures the path is within the allowed backup directory
 */
export function validateBackupPath(backupDir: string, filePath: string): boolean {
  if (!filePath || !backupDir) return false;

  // Normalize paths
  const normalizedBackupDir = backupDir.replace(/\\/g, '/').toLowerCase();
  const normalizedFilePath = filePath.replace(/\\/g, '/').toLowerCase();

  // Check if file path starts with backup directory
  if (!normalizedFilePath.startsWith(normalizedBackupDir)) {
    return false;
  }

  // Check for path traversal in the relative path
  const relativePath = normalizedFilePath.slice(normalizedBackupDir.length);
  if (relativePath.includes('..')) {
    return false;
  }

  // Check file extension
  if (!filePath.endsWith('.db')) {
    return false;
  }

  return true;
}

/**
 * Sanitize HTML to prevent XSS (basic implementation)
 * Note: For full XSS protection, use a library like DOMPurify
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return true; // Empty is valid (optional field)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (Turkish)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Empty is valid (optional field)
  const digits = phone.replace(/\D/g, '');
  return digits.length === 0 || digits.length === 11;
}

/**
 * Validate IBAN format
 */
export function isValidIBAN(iban: string): boolean {
  if (!iban) return true; // Empty is valid (optional field)
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (cleaned.length === 0) return true;

  // Turkish IBAN: TR + 2 check digits + 22 digits = 26 characters
  const ibanRegex = /^TR[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
  return ibanRegex.test(cleaned);
}

/**
 * Validate TC Kimlik No (Turkish ID number)
 */
export function isValidTCKN(tckn: string): boolean {
  if (!tckn) return true; // Empty is valid (optional field)

  // Must be 11 digits, first digit cannot be 0
  if (!/^[1-9][0-9]{10}$/.test(tckn)) {
    return false;
  }

  // Algorithmic validation
  const digits = tckn.split('').map(Number);

  // 10th digit check
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  const check10 = (odd * 7 - even) % 10;
  if (check10 !== digits[9]) return false;

  // 11th digit check
  const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (sum10 % 10 !== digits[10]) return false;

  return true;
}

/**
 * Rate limiting helper for API calls
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return true;
    }

    return false;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  getResetTime(): number {
    if (this.timestamps.length === 0) return 0;
    const oldestTimestamp = Math.min(...this.timestamps);
    return Math.max(0, this.windowMs - (Date.now() - oldestTimestamp));
  }
}

// Global rate limiter for exchange rate API
export const exchangeRateLimiter = new RateLimiter(5, 60000); // 5 requests per minute
