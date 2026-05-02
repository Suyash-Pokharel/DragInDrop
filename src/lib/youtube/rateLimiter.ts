/**
 * YouTube Rate Limiter Module
 *
 * This module enforces YouTube API rate limits using Redis to track usage across
 * distributed serverless instances. Rate limits are enforced per user per day.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import { getRedis } from "../redis";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxUploadsPerDay: number; // 6 (based on 10,000 quota / 1600 per upload)
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
 * Requirement: 11.2
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxUploadsPerDay: 6, // 10,000 quota units / 1600 per upload = ~6 uploads/day
};

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
 * Check if a user has exceeded the upload rate limit
 *
 * This function checks if the user has remaining upload quota for the current day.
 * Rate limit: 6 uploads per user per day (Requirement 11.2)
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<RateLimitResult>} Rate limit check result
 *
 * Requirements: 11.1, 11.2, 11.4, 11.6
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
  const redis = getRedis();
  const dateKey = getDateKey();
  const key = `youtube:upload:${userId}:${dateKey}`; // Requirement: 11.4
  const limit = DEFAULT_CONFIG.maxUploadsPerDay;
  const resetAt = new Date(getMidnightUTC() * 1000); // Requirement: 11.5

  try {
    // Get current count
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Check if limit exceeded
    // Requirement: 11.2 - Enforce limit: 6 uploads per user per day
    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Requirement: 11.7 - Return {allowed: boolean, remaining: number, resetAt: Date}
    return {
      allowed: true,
      remaining: limit - count,
      resetAt,
    };
  } catch (error) {
    // Log error but allow operation to proceed (fail open)
    // Requirement: 11.1 - Use Redis for distributed rate limiting
    console.error("[YouTube rateLimiter] Error checking upload rate limit:", error);
    return {
      allowed: true,
      remaining: limit,
      resetAt,
    };
  }
}

/**
 * Increment the upload counter for a user
 *
 * This function increments the upload counter and sets expiration to midnight UTC.
 * The counter resets automatically at midnight UTC (Requirement 11.5).
 *
 * @param {string} userId - The user ID to increment
 * @returns {Promise<void>}
 *
 * Requirements: 11.3, 11.4, 11.5, 11.6
 *
 * Redis Key Format: youtube:upload:{userId}:{YYYYMMDD}
 * Expiration: Midnight UTC
 *
 * @example
 * await incrementUploadCounter('user123');
 */
export async function incrementUploadCounter(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const dateKey = getDateKey();
    const key = `youtube:upload:${userId}:${dateKey}`; // Requirement: 11.4
    const expireAt = getMidnightUTC(); // Requirement: 11.5

    // Increment counter
    // Requirement: 11.3 - Implement incrementUploadCounter function
    await redis.incr(key);

    // Set expiration to midnight UTC
    // Requirement: 11.5 - Set key expiration to midnight UTC
    await redis.expireat(key, expireAt);
  } catch (error) {
    // Log error but don't throw (fail silently for counter increments)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[YouTube rateLimiter] Error incrementing upload counter:", errorMessage);
  }
}
