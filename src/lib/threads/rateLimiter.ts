/**
 * Threads Rate Limiter Module
 *
 * This module enforces Threads API rate limits using Redis to track usage across
 * distributed serverless instances. Rate limits are enforced per user per 24-hour
 * rolling window. Falls back to in-memory rate limiting if Redis is unavailable.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { getRedis } from "../redis";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxUploadsPerDay: number; // 250
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
  maxUploadsPerDay: 250,
};

/**
 * In-memory fallback storage for rate limiting when Redis is unavailable
 * Key format: {userId}:{timestamp}
 * Value: { count: number, resetAt: number }
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Get the current timestamp in seconds
 *
 * @returns {number} Unix timestamp in seconds
 */
function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get the reset timestamp (24 hours from now)
 *
 * @returns {number} Unix timestamp in seconds
 */
function getResetTimestamp(): number {
  return getCurrentTimestamp() + 24 * 60 * 60; // 24 hours
}

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore(): void {
  const now = getCurrentTimestamp();
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
 * @param {number} limit - The rate limit
 * @param {Date} resetAt - The reset timestamp
 * @returns {RateLimitResult} Rate limit check result
 */
function checkInMemoryRateLimit(userId: string, limit: number, resetAt: Date): RateLimitResult {
  cleanupInMemoryStore();

  // Find all entries for this user
  let totalCount = 0;
  const now = getCurrentTimestamp();

  for (const [key, value] of inMemoryStore.entries()) {
    if (key.startsWith(`${userId}:`) && value.resetAt > now) {
      totalCount += value.count;
    }
  }

  if (totalCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: limit - totalCount,
    resetAt,
  };
}

/**
 * Increment the upload counter using in-memory fallback
 *
 * @param {string} userId - The user ID to increment
 * @param {number} timestamp - The current timestamp
 * @param {number} expireAt - The expiration timestamp in seconds
 */
function incrementInMemoryCounter(userId: string, timestamp: number, expireAt: number): void {
  cleanupInMemoryStore();
  const key = `${userId}:${timestamp}`;
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
 * This function checks if the user has remaining upload quota for the current 24-hour window.
 * Rate limit: 250 uploads per user per 24 hours (Requirement 9.2)
 * Falls back to in-memory rate limiting if Redis is unavailable (Requirement 9.6)
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<RateLimitResult>} Rate limit check result
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7
 *
 * Redis Key Format: threads:upload:{userId}:{timestamp}
 * Expiration: 24 hours from creation
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
  const limit = DEFAULT_CONFIG.maxUploadsPerDay;
  const now = getCurrentTimestamp();
  const windowStart = now - 24 * 60 * 60; // 24 hours ago
  const resetAt = new Date((now + 24 * 60 * 60) * 1000);

  try {
    const redis = getRedis();

    // Get all keys for this user within the 24-hour window
    // Requirement: 9.3 - Use Redis key format threads:upload:{userId}:{timestamp}
    const pattern = `threads:upload:${userId}:*`;
    const keys = await redis.keys(pattern);

    // Count uploads within the 24-hour rolling window
    let count = 0;
    for (const key of keys) {
      // Extract timestamp from key
      const parts = key.split(":");
      const timestamp = parseInt(parts[parts.length - 1], 10);

      // Only count if within 24-hour window
      if (timestamp >= windowStart) {
        const value = await redis.get(key);
        if (value) {
          count += parseInt(value, 10);
        }
      }
    }

    // Log when approaching rate limit (80% threshold)
    // Requirement: 9.7
    if (count >= limit * 0.8 && count < limit) {
      console.warn(
        `[Threads rateLimiter] User ${userId} approaching Threads upload rate limit: ${count}/${limit}`,
      );
    }

    // Check if limit exceeded
    // Requirement: 9.4
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
    console.error(
      "[Threads rateLimiter] Redis error, falling back to in-memory rate limiting:",
      error,
    );
    return checkInMemoryRateLimit(userId, limit, resetAt);
  }
}

/**
 * Increment the upload counter for a user
 *
 * This function increments the upload counter and sets expiration to 24 hours.
 * The counter uses a rolling 24-hour window (Requirement 9.5).
 * Falls back to in-memory counter if Redis is unavailable (Requirement 9.6).
 *
 * @param {string} userId - The user ID to increment
 * @returns {Promise<void>}
 *
 * Requirements: 9.1, 9.3, 9.5, 9.6
 *
 * Redis Key Format: threads:upload:{userId}:{timestamp}
 * Expiration: 24 hours from creation
 *
 * @example
 * await incrementUploadCounter('user123');
 */
export async function incrementUploadCounter(userId: string): Promise<void> {
  const timestamp = getCurrentTimestamp();
  const key = `threads:upload:${userId}:${timestamp}`;
  const expireAt = getResetTimestamp();

  try {
    const redis = getRedis();

    // Increment counter
    await redis.incr(key);

    // Set expiration to 24 hours
    // Requirement: 9.5
    await redis.expireat(key, expireAt);
  } catch (error) {
    // Fall back to in-memory counter if Redis is unavailable
    // Requirement: 9.6
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(
      "[Threads rateLimiter] Redis error, falling back to in-memory counter:",
      errorMessage,
    );
    incrementInMemoryCounter(userId, timestamp, expireAt);
  }
}
