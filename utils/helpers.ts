/**
 * helpers.ts
 * Utility functions untuk NurCake POS sync system
 *
 * Path: src/utils/helpers.ts
 */

import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// UUID GENERATION
// ============================================================================

/**
 * Generate UUID v4
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate short ID for display purposes
 * Format: XXXXXXXX (8 karakter uppercase)
 */
export function generateShortId(): string {
  return uuidv4().split("-")[0].toUpperCase();
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================================================
// TIMESTAMP UTILITIES
// ============================================================================

/**
 * Get current timestamp in ISO format
 * Format: 2024-01-15T10:30:00.000Z
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current date only in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Parse ISO timestamp to Date object
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Format timestamp for display
 * @param timestamp ISO timestamp string
 * @param options Formatting options
 */
export function formatTimestamp(
  timestamp: string | Date,
  options: {
    dateOnly?: boolean;
    timeOnly?: boolean;
    relative?: boolean;
    locale?: string;
  } = {}
): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const locale = options.locale || "id-ID";

  if (options.relative) {
    return formatRelativeTime(date);
  }

  if (options.dateOnly) {
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (options.timeOnly) {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format timestamp as relative time (e.g., "5 menit yang lalu")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Baru saja";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} menit yang lalu`;
  } else if (diffHours < 24) {
    return `${diffHours} jam yang lalu`;
  } else if (diffDays < 7) {
    return `${diffDays} hari yang lalu`;
  } else {
    return formatTimestamp(target, { dateOnly: true });
  }
}

/**
 * Check if timestamp is older than specified minutes
 */
export function isOlderThan(timestamp: string, minutes: number): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes > minutes;
}

/**
 * Check if timestamp is today
 */
export function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Get start of day timestamp
 */
export function getStartOfDay(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Get end of day timestamp
 */
export function getEndOfDay(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format number as Indonesian Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("id-ID").format(num);
}

/**
 * Parse formatted number string to number
 */
export function parseFormattedNumber(str: string): number {
  // Remove thousand separators and parse
  const cleaned = str.replace(/[^\d,-]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str: string): string {
  return str
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Sanitize string for SQL (basic)
 */
export function sanitize(str: string): string {
  if (!str) return "";
  return str.replace(/'/g, "''");
}

/**
 * Format phone number (Indonesia)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  // Format as +62 XXX-XXXX-XXXX
  if (digits.startsWith("62")) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(
      5,
      9
    )}-${digits.slice(9)}`;
  }
  if (digits.startsWith("0")) {
    return `+62 ${digits.slice(1, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array by key
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// ============================================================================
// SYNC UTILITIES
// ============================================================================

/**
 * Generate batch ID for sync operations
 */
export function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `batch_${timestamp}_${random}`;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt, baseDelay, maxDelay);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

// ============================================================================
// DEVICE UTILITIES
// ============================================================================

/**
 * Generate device ID
 * Format: DEVICE-XXXXXXXX
 */
export function generateDeviceId(): string {
  return `DEVICE-${generateShortId()}`;
}

/**
 * Get device type from User-Agent or platform
 */
export function getDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  // In React Native, we can use Platform
  try {
    const { Platform } = require("react-native");
    if (Platform.OS === "ios" || Platform.OS === "android") {
      // Could further detect tablet vs phone using screen dimensions
      return "mobile";
    }
  } catch {
    // Not in React Native environment
  }
  return "unknown";
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate phone number (Indonesia)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // Indonesian phone numbers: 10-13 digits, starts with 0 or 62
  return /^(0|62)[0-9]{9,12}$/.test(digits);
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * Create typed error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}
