/**
 * Instagram Rate Limiter Module
 *
 * This module enforces Instagram API rate limits using Redis to track usage across
 * distributed serverless instances. Rate limits are enforced per user per day.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */

import { getRedis } from "../redis";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxUploadsPerDay: number; // 6
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Default rate limit configuration
 * Requirement: 9.2
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxUploadsPerDay: 6,
};

/**
 * In-memory fallback storage for rate limiting when Redis is unavailable
 * Key format: {userId}:{YYYYMMDD}
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Get the current date in YYYYMMDD format (UTC)
 *
 * @returns {string} Date string in YYYYMMDD format
 */
function getDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Get the timestamp for midnight UTC (start of next day)
 *
 * @returns {number} Unix timestamp in seconds
 */
function getMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return Math.floor(midnight.getTime() / 1000);
}

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore(): void {
  const now = Date.now() / 1000;
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAt < now) {
      inMemoryStore.delete(key);
    }
  }
}

/**
 * Check if a user has exceeded the upload rate limit using in-memory fallback
 *
 * @param {string} userId - The user ID to check
 * @param {string} dateKey - The date key in YYYYMMDD format
 * @param {number} limit - The rate limit
 * @param {Date} resetAt - The reset timestamp
 * @returns {RateLimitResult} Rate limit check result
 */
function checkInMemoryRateLimit(
  userId: string,
  dateKey: string,
  limit: number,
  resetAt: Date,
): RateLimitResult {
  cleanupInMemoryStore();
  const key = `${userId}:${dateKey}`;
  const entry = inMemoryStore.get(key);
  const count = entry?.count || 0;

  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: limit - count,
    resetAt,
  };
}

/**
 * Increment the upload counter using in-memory fallback
 *
 * @param {string} userId - The user ID to increment
 * @param {string} dateKey - The date key in YYYYMMDD format
 * @param {number} expireAt - The expiration timestamp in seconds
 */
function incrementInMemoryCounter(userId: string, dateKey: string, expireAt: number): void {
  cleanupInMemoryStore();
  const key = `${userId}:${dateKey}`;
  const entry = inMemoryStore.get(key);

  if (entry) {
    entry.count += 1;
  } else {
    inMemoryStore.set(key, { count: 1, resetAt: expireAt });
  }
}

/**
 * Check if a user has exceeded the upload rate limit
 *
 * This function checks if the user has remaining upload quota for the current day.
 * Rate limit: 6 uploads per user per day (Requirement 9.2)
 * Falls back to in-memory rate limiting if Redis is unavailable (Requirement 9.6)
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<RateLimitResult>} Rate limit check result
 *
 * Requirements: 9.1, 9.2, 9.3, 9.6, 9.7
 *
 * @example
 * const result = await checkUploadRateLimit('user123');
 * if (result.allowed) {
 *   // Proceed with upload
 * } else {
 *   // Rate limit exceeded
 * }
 */
export async function checkUploadRateLimit(userId: string): Promise<RateLimitResult> {
  const dateKey = getDateKey();
  const key = `instagram:upload:${userId}:${dateKey}`;
  const limit = DEFAULT_CONFIG.maxUploadsPerDay;
  const resetAt = new Date(getMidnightUTC() * 1000);

  try {
    const redis = getRedis();

    // Get current count
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Log when approaching rate limit (80% threshold)
    // Requirement: 9.8
    if (count >= limit * 0.8 && count < limit) {
      console.warn(
        `[rateLimiter] User ${userId} approaching Instagram upload rate limit: ${count}/${limit}`,
      );
    }

    // Check if limit exceeded
    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: limit - count,
      resetAt,
    };
  } catch (error) {
    // Fall back to in-memory rate limiting if Redis is unavailable
    // Requirement: 9.6
    console.error("[rateLimiter] Redis error, falling back to in-memory rate limiting:", error);
    return checkInMemoryRateLimit(userId, dateKey, limit, resetAt);
  }
}

/**
 * Increment the upload counter for a user
 *
 * This function increments the upload counter and sets expiration to midnight UTC.
 * The counter resets automatically at midnight UTC (Requirement 9.5).
 * Falls back to in-memory counter if Redis is unavailable (Requirement 9.6).
 *
 * @param {string} userId - The user ID to increment
 * @returns {Promise<void>}
 *
 * Requirements: 9.3, 9.4, 9.5, 9.6
 *
 * Redis Key Format: instagram:upload:{userId}:{YYYYMMDD}
 * Expiration: Midnight UTC
 *
 * @example
 * await incrementUploadCounter('user123');
 */
export async function incrementUploadCounter(userId: string): Promise<void> {
  const dateKey = getDateKey();
  const key = `instagram:upload:${userId}:${dateKey}`;
  const expireAt = getMidnightUTC();

  try {
    const redis = getRedis();

    // Increment counter
    await redis.incr(key);

    // Set expiration to midnight UTC
    // Requirement: 9.5
    await redis.expireat(key, expireAt);
  } catch (error) {
    // Fall back to in-memory counter if Redis is unavailable
    // Requirement: 9.6
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(
      "[rateLimiter] Redis error, falling back to in-memory counter:",
      errorMessage,
    );
    incrementInMemoryCounter(userId, dateKey, expireAt);
  }
}
