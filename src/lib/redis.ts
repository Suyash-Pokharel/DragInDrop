import Redis from "ioredis";

declare global {
  var __ioredisClient: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export function getRedis(): Redis {
  if (global.__ioredisClient) return global.__ioredisClient;
  
  const client = new Redis(redisUrl, { 
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    commandTimeout: 3000,
    keepAlive: 30000,
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 1000);
    },
  });
  
  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });
  
  if (process.env.NODE_ENV !== "production") {
    client.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }
  
  if (process.env.NODE_ENV !== "production") global.__ioredisClient = client;
  return client;
}

export default getRedis;
