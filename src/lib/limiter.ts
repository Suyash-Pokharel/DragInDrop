import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import { getRedis } from "./redis";

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
      insuranceLimiter: memoryLimiter,
    });
    return redisLimiter;
  } catch {
    return memoryLimiter;
  }
}

export const perIpLimiter = createResilientLimiter({
  keyPrefix: "rl_ip",
  points: 100,
  duration: 60 * 60,
});

export const perFpLimiter = createResilientLimiter({
  keyPrefix: "rl_fp",
  points: 50,
  duration: 60 * 60,
});

export const perEmailLimiter = createResilientLimiter({
  keyPrefix: "rl_email",
  points: 10,
  duration: 60 * 60,
});

export const perIpLoginLimiter = createResilientLimiter({
  keyPrefix: "rl_login_ip",
  points: 20,
  duration: 15 * 60,
});

export const perEmailLoginLimiter = createResilientLimiter({
  keyPrefix: "rl_login_email",
  points: 10,
  duration: 15 * 60,
});

export const perIpOAuthLimiter = createResilientLimiter({
  keyPrefix: "rl_oauth_ip",
  points: 50,
  duration: 15 * 60,
});

export const perUserOAuthLimiter = createResilientLimiter({
  keyPrefix: "rl_oauth_user",
  points: 20,
  duration: 15 * 60,
});
