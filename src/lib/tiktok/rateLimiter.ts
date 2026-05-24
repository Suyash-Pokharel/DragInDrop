/**
 * TikTok Rate Limiter Module
 *
 * This module enforces TikTok API rate limits using Redis to track usage across
 * distributed serverless instances. Rate limits are enforced per user per day.
 *
 */

import { getRedis } from "../redis";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxUploadsPerDay: number; // 10
  maxStatusPollsPerDay: number; // 100
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
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxUploadsPerDay: 10,
  maxStatusPollsPerDay: 100,
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
 * Rate limit: 10 uploads per user per day (
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<RateLimitResult>} Rate limit check result
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
  const key = `tiktok:upload:${userId}:${dateKey}`;
  const limit = DEFAULT_CONFIG.maxUploadsPerDay;
  const resetAt = new Date(getMidnightUTC() * 1000);

  try {
    // Get current count
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

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
    // Log error but allow operation to proceed (fail open)
    console.error("[rateLimiter] Error checking upload rate limit:", error);
    return {
      allowed: true,
      remaining: limit,
      resetAt,
    };
  }
}

/**
 * Check if a user has exceeded the status poll rate limit
 *
 * This function checks if the user has remaining status poll quota for the current day.
 * Rate limit: 100 status polls per user per day (
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<RateLimitResult>} Rate limit check result
 *
 *
 * @example
 * const result = await checkStatusPollRateLimit('user123');
 * if (result.allowed) {
 *   // Proceed with status poll
 * } else {
 *   // Rate limit exceeded
 * }
 */
export async function checkStatusPollRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = getRedis();
  const dateKey = getDateKey();
  const key = `tiktok:poll:${userId}:${dateKey}`;
  const limit = DEFAULT_CONFIG.maxStatusPollsPerDay;
  const resetAt = new Date(getMidnightUTC() * 1000);

  try {
    // Get current count
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

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
    // Log error but allow operation to proceed (fail open)
    console.error("[rateLimiter] Error checking status poll rate limit:", error);
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
 * The counter resets automatically at midnight UTC (
 *
 * @param {string} userId - The user ID to increment
 * @returns {Promise<void>}
 *
 *
 * Redis Key Format: tiktok:upload:{userId}:{YYYYMMDD}
 * Expiration: Midnight UTC
 *
 * @example
 * await incrementUploadCounter('user123');
 */
export async function incrementUploadCounter(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const dateKey = getDateKey();
    const key = `tiktok:upload:${userId}:${dateKey}`;
    const expireAt = getMidnightUTC();

    // Increment counter
    await redis.incr(key);

    // Set expiration to midnight UTC
    // 
    await redis.expireat(key, expireAt);
  } catch (error) {
    // Log error but don't throw (fail silently for counter increments)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[rateLimiter] Error incrementing upload counter:", errorMessage);
  }
}

/**
 * Increment the status poll counter for a user
 *
 * This function increments the status poll counter and sets expiration to midnight UTC.
 * The counter resets automatically at midnight UTC (
 *
 * @param {string} userId - The user ID to increment
 * @returns {Promise<void>}
 *
 *
 * Redis Key Format: tiktok:poll:{userId}:{YYYYMMDD}
 * Expiration: Midnight UTC
 *
 * @example
 * await incrementStatusPollCounter('user123');
 */
export async function incrementStatusPollCounter(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const dateKey = getDateKey();
    const key = `tiktok:poll:${userId}:${dateKey}`;
    const expireAt = getMidnightUTC();

    // Increment counter
    await redis.incr(key);

    // Set expiration to midnight UTC
    // 
    await redis.expireat(key, expireAt);
  } catch (error) {
    // Log error but don't throw (fail silently for counter increments)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[rateLimiter] Error incrementing status poll counter:", errorMessage);
  }
}
