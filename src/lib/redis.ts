import Redis from "ioredis";

declare global {
  var __ioredisClient: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export function getRedis(): Redis {
  if (global.__ioredisClient) return global.__ioredisClient;
  // Use lazyConnect so creating the client doesn't immediately open sockets
  const client = new Redis(redisUrl, { lazyConnect: true });
  // Prevent unhandled error events during build-time operations
  client.on("error", () => {
    // swallow errors here; callers should handle connection/command errors
  });
  if (process.env.NODE_ENV !== "production") global.__ioredisClient = client;
  return client;
}

export default getRedis;
