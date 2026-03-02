import Redis from "ioredis";

// Use REDIS_URL env var in production; fallback to localhost for dev
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redis = new Redis(redisUrl);

export default redis;
