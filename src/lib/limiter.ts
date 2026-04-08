import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import { getRedis } from "./redis";

/**
 * Create a rate limiter that uses Redis when available, falling back to
 * an in-memory limiter when Redis is down or unavailable.
 */
function createResilientLimiter(opts: { keyPrefix: string; points: number; duration: number }) {
  const memoryLimiter = new RateLimiterMemory({
    keyPrefix: `${opts.keyPrefix}_mem`,
    points: opts.points,
    duration: opts.duration,
  });

  try {
    const redisClient = getRedis();
    const redisLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: opts.keyPrefix,
      points: opts.points,
      duration: opts.duration,
      // Fall back to in-memory limiter when Redis errors
      insuranceLimiter: memoryLimiter,
    });
    return redisLimiter;
  } catch {
    // If Redis client itself can't be created, use memory limiter
    return memoryLimiter;
  }
}

// Example limits — tweak as necessary
export const perIpLimiter = createResilientLimiter({
  keyPrefix: "rl_ip",
  points: 100, // 100 requests
  duration: 60 * 60, // per hour
});

export const perFpLimiter = createResilientLimiter({
  keyPrefix: "rl_fp",
  points: 50, // 50 requests
  duration: 60 * 60, // per hour
});

export const perEmailLimiter = createResilientLimiter({
  keyPrefix: "rl_email",
  points: 10, // 10 sends
  duration: 60 * 60, // per hour
});

export const perIpLoginLimiter = createResilientLimiter({
  keyPrefix: "rl_login_ip",
  points: 20, // 20 login attempts
  duration: 15 * 60, // per 15 minutes
});

export const perEmailLoginLimiter = createResilientLimiter({
  keyPrefix: "rl_login_email",
  points: 10, // 10 login attempts per email
  duration: 15 * 60, // per 15 minutes
});
