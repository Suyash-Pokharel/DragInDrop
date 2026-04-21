import Redis from "ioredis";

declare global {
  var __ioredisClient: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export function getRedis(): Redis {
  if (global.__ioredisClient) return global.__ioredisClient;
  
  // Create Redis client optimized for serverless environments
  const client = new Redis(redisUrl, { 
    // Don't use lazyConnect in production - establish connection immediately
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Add connection timeout for faster failures
    connectTimeout: 5000,
    // Reduce command timeout for serverless
    commandTimeout: 3000,
    // Keep connection alive
    keepAlive: 30000,
    // Reconnect on error
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts
      }
      return Math.min(times * 200, 1000); // Exponential backoff up to 1 second
    },
  });
  
  // Prevent unhandled error events
  client.on("error", (err) => {
    // Log errors but don't crash
    console.error("[Redis] Connection error:", err.message);
  });
  
  // Log successful connection in development
  if (process.env.NODE_ENV !== "production") {
    client.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }
  
  if (process.env.NODE_ENV !== "production") global.__ioredisClient = client;
  return client;
}

export default getRedis;
