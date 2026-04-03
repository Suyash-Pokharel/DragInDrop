import Redis from "ioredis";

declare global {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	var __ioredisClient: Redis | undefined;
}

/**
 * Redis URL for rate limiting and session storage.
 * 
 * IMPORTANT: REDIS_URL must be configured in production environments.
 * For Vercel deployments, configure REDIS_URL in your project's environment variables.
 * Recommended Redis providers:
 * - Upstash Redis (serverless-friendly): https://upstash.com/
 * - Vercel KV (built-in): https://vercel.com/docs/storage/vercel-kv
 * - Redis Cloud: https://redis.com/
 * 
 * For local development, you can use a local Redis instance or leave it undefined
 * to fall back to in-memory rate limiting.
 */
const redisUrl = process.env.REDIS_URL;

export function getRedis(): Redis {
	// In production, REDIS_URL must be configured for proper rate limiting across serverless instances
	if (process.env.NODE_ENV === "production" && !redisUrl) {
		throw new Error(
			"REDIS_URL environment variable is required in production. " +
			"Please configure a Redis instance (Upstash Redis, Vercel KV, or Redis Cloud) " +
			"in your Vercel project settings."
		);
	}

	// If no Redis URL is configured in development, return a client that will fail gracefully
	// This allows the rate limiter to fall back to in-memory storage
	if (!redisUrl) {
		const client = new Redis({ lazyConnect: true });
		client.on("error", () => {
			// swallow errors here; callers should handle connection/command errors
		});
		return client;
	}

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
