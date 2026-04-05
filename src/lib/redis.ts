import Redis from "ioredis";

declare global {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	var __ioredisClient: Redis | undefined;
}

/**
 * Redis URL for rate limiting and session storage.
 * 
 * When available, Redis provides distributed rate limiting across serverless instances.
 * When unavailable, the rate limiter falls back to in-memory storage (per-instance).
 * 
 * Recommended Redis providers for Vercel:
 * - Upstash Redis (serverless-friendly): https://upstash.com/
 * - Vercel KV (built-in): https://vercel.com/docs/storage/vercel-kv
 * - Redis Cloud: https://redis.com/
 */
const redisUrl = process.env.REDIS_URL;

export function getRedis(): Redis {
	// If no Redis URL is configured, return a lazy client that will fail gracefully
	// The rate limiter's insuranceLimiter (in-memory) will handle rate limiting
	if (!redisUrl) {
		if (process.env.NODE_ENV === "production") {
			console.warn(
				"REDIS_URL not configured — using in-memory rate limiting. " +
				"For distributed rate limiting across serverless instances, " +
				"configure Upstash Redis or Vercel KV."
			);
		}
		const client = new Redis({ lazyConnect: true });
		client.on("error", () => {
			// swallow errors; the insuranceLimiter (in-memory) will take over
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
