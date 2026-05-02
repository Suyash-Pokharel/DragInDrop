import Redis from "ioredis";

declare global {
  var __ioredisClient: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Check if Redis client is healthy and connected
 */
function isRedisHealthy(client: Redis): boolean {
  return client.status === "ready" || client.status === "connecting";
}

/**
 * Create a new Redis client with serverless-optimized configuration
 */
function createRedisClient(): Redis {
  const client = new Redis(redisUrl, {
    // Lazy connect for better serverless performance
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    // Enable offline queue to prevent errors during reconnection
    enableOfflineQueue: true,
    // Add connection timeout for faster failures
    connectTimeout: 5000,
    // Reduce command timeout for serverless
    commandTimeout: 5000,
    // Keep connection alive
    keepAlive: 30000,
    // Reconnect on error with exponential backoff
    retryStrategy(times) {
      if (times > 5) {
        console.error("[Redis] Max retry attempts reached, giving up");
        return null; // Stop retrying after 5 attempts
      }
      const delay = Math.min(times * 200, 2000);
      console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  });

  // Prevent unhandled error events
  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("close", () => {
    console.log("[Redis] Connection closed");
  });

  client.on("reconnecting", () => {
    console.log("[Redis] Reconnecting...");
  });

  // Log successful connection in development
  if (process.env.NODE_ENV !== "production") {
    client.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }

  return client;
}

/**
 * Get or create Redis client with health checking
 *
 * In serverless environments, connections can become stale between invocations.
 * This function checks connection health and recreates the client if needed.
 */
export function getRedis(): Redis {
  // Check if existing client is healthy
  if (global.__ioredisClient && isRedisHealthy(global.__ioredisClient)) {
    return global.__ioredisClient;
  }

  // Clean up old client if it exists
  if (global.__ioredisClient) {
    console.log("[Redis] Cleaning up stale connection");
    try {
      global.__ioredisClient.disconnect(false);
    } catch {
      // Ignore cleanup errors
    }
    global.__ioredisClient = undefined;
  }

  // Create new client
  console.log("[Redis] Creating new client");
  const client = createRedisClient();

  // Connect immediately
  client.connect().catch((err) => {
    console.error("[Redis] Failed to connect:", err.message);
  });

  // Cache in development only (in production, let it recreate on each invocation if needed)
  if (process.env.NODE_ENV !== "production") {
    global.__ioredisClient = client;
  }

  return client;
}

export default getRedis;
