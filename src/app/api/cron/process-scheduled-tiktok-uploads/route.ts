/**
 * Scheduled TikTok Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * TikTok uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Uploading videos to TikTok (implemented in Task 6.2)
 * - Polling upload status (implemented in Task 6.3)
 * - Updating database records (implemented in Task 6.4)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount, PlatformPostStatus, PostStatus } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { isTokenExpired, refreshToken } from "@/lib/tokenManager";
import {
  checkUploadRateLimit,
  incrementUploadCounter,
  checkStatusPollRateLimit,
  incrementStatusPollCounter,
} from "@/lib/tiktok/rateLimiter";
import { buildSignedVideoUrl } from "@/lib/backblaze/urlBuilder";
import { uploadVideo, pollStatus, UploadVideoResponse, PollStatusResponse } from "@/lib/tiktok/api";

/**
 * Summary of processing results
 */
interface ProcessResult {
  processed: number;
  uploaded: number;
  polled: number;
  errors: string[];
}

/**
 * Result of uploading a single post
 */
interface UploadResult {
  success: boolean;
  publishId?: string;
  error?: string;
  shouldSkip?: boolean; // True if rate limited or other non-fatal error
}

/**
 * Result of polling upload status
 */
interface StatusResult {
  success: boolean;
  statusUpdated?: boolean;
  error?: string;
  shouldSkip?: boolean; // True if rate limited or other non-fatal error
}

/**
 * Verify the CRON_SECRET from the Authorization header
 *
 * This function checks if the request includes a valid Authorization header
 * with the correct CRON_SECRET to prevent unauthorized access.
 *
 * @param {NextRequest} request - The incoming request
 * @returns {boolean} True if the secret is valid, false otherwise
 *
 * Requirements: 3.2, 3.3
 *
 * @example
 * if (!verifyCronSecret(request)) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    console.error("[process-scheduled-tiktok-uploads] No Authorization header");
    return false;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[process-scheduled-tiktok-uploads] CRON_SECRET not configured");
    return false;
  }

  // Debug logging (safe - only logs lengths and first/last 4 chars)
  console.log("[process-scheduled-tiktok-uploads] Auth debug:", {
    receivedTokenLength: token.length,
    receivedTokenStart: token.substring(0, 4),
    receivedTokenEnd: token.substring(token.length - 4),
    expectedSecretLength: cronSecret.length,
    expectedSecretStart: cronSecret.substring(0, 4),
    expectedSecretEnd: cronSecret.substring(cronSecret.length - 4),
    match: token === cronSecret,
  });

  return token === cronSecret;
}

/**
 * Calculate the scheduling window for finding posts to process
 *
 * The scheduling window is ±6 minutes from the current time to ensure posts
 * scheduled between cron runs are not missed.
 *
 * @returns {{ start: Date; end: Date }} The start and end of the scheduling window
 *
 * Requirements: 4.1, 4.2, 4.3
 *
 * @example
 * const window = getSchedulingWindow();
 * // If current time is 10:30:00
 * // window.start = 10:24:00
 * // window.end = 10:36:00
 */
function getSchedulingWindow(): { start: Date; end: Date } {
  const now = new Date();
  const sixMinutesInMs = 6 * 60 * 1000;

  const start = new Date(now.getTime() - sixMinutesInMs);
  const end = new Date(now.getTime() + sixMinutesInMs);

  return { start, end };
}

/**
 * POST /api/cron/process-scheduled-tiktok-uploads
 *
 * Main handler for processing scheduled TikTok uploads. This endpoint:
 * 1. Verifies the CRON_SECRET for authentication
 * 2. Queries for scheduled posts within the scheduling window
 * 3. Processes uploads and status polling (to be implemented in Tasks 6.2-6.6)
 * 4. Returns a summary of operations
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4
 *
 * @param {NextRequest} request - The incoming request from cron-job.org
 * @returns {Promise<NextResponse>} Response with processing summary or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET
  // Requirements: 3.2, 3.3
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-tiktok-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Requirement 11.1: Log cron execution start with timestamp
  console.log("[process-scheduled-tiktok-uploads] Cron execution started:", {
    timestamp: new Date().toISOString(),
  });

  try {
    const prisma = getPrisma();
    const window = getSchedulingWindow();

    // Query for scheduled posts within the scheduling window
    // Requirements: 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4
    const scheduledPosts = await prisma.post.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          gte: window.start,
          lte: window.end,
        },
      },
      include: {
        PlatformPost: {
          where: {
            status: "PENDING",
            SocialAccount: {
              platform: "TikTok",
              isActive: true,
            },
          },
          include: {
            SocialAccount: true,
          },
        },
      },
    });

    // Filter to only include posts with TikTok PlatformPost records
    // Requirement: 3.5
    const postsToProcess = scheduledPosts.filter((post) => post.PlatformPost.length > 0);

    // Requirement 11.2: Log count of posts found in scheduling window
    console.log("[process-scheduled-tiktok-uploads] Found posts to process:", {
      timestamp: new Date().toISOString(),
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      totalScheduled: scheduledPosts.length,
      withTikTok: postsToProcess.length,
    });

    // Initialize result summary
    const result: ProcessResult = {
      processed: postsToProcess.length,
      uploaded: 0,
      polled: 0,
      errors: [],
    };

    // Process scheduled posts for upload
    // Requirement: 6.2 - Implement upload processing logic
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Process publishing posts for status polling
    // Requirement: 6.3 - Implement status polling logic
    const pollResult = await processPublishingPosts();
    result.polled = pollResult.polled;
    result.errors.push(...pollResult.errors);

    // Sync Post status for all processed posts
    // Requirement: 10.1, 10.2, 10.3, 10.4, 10.5
    const postIds = new Set<string>();
    for (const post of postsToProcess) {
      postIds.add(post.id);
    }

    // Also sync status for posts that were polled
    const polledPosts = await prisma.platformPost.findMany({
      where: {
        status: {
          in: ["PUBLISHED", "FAILED"],
        },
        updatedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Updated in last 5 minutes
        },
      },
      select: {
        postId: true,
      },
    });

    for (const pp of polledPosts) {
      postIds.add(pp.postId);
    }

    // Sync status for all affected posts
    for (const postId of postIds) {
      try {
        await syncPostStatus(postId);
      } catch (error) {
        console.error("[process-scheduled-tiktok-uploads] Failed to sync post status:", {
          postId,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Requirement 11.1: Log cron execution end with timestamp
    console.log("[process-scheduled-tiktok-uploads] Cron execution completed:", {
      timestamp: new Date().toISOString(),
      result,
    });

    // Return HTTP 200 with summary
    // Requirement: 3.7
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Return HTTP 500 on database errors
    // Requirement: 3.8
    // Requirement 11.5: Log all errors with full context
    console.error("[process-scheduled-tiktok-uploads] Database error:", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Process scheduled posts for upload to TikTok
 *
 * This function processes each scheduled post by:
 * 1. Retrieving and decrypting the SocialAccount tokens
 * 2. Checking if the access token is expired and refreshing if needed
 * 3. Checking upload rate limits
 * 4. Generating a signed Backblaze URL for the video
 * 5. Calling TikTok API to initiate upload
 * 6. Updating the database with the publish_id and status
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7,
 *               6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11,
 *               9.2, 9.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 *
 * @param posts - Array of posts with PlatformPost and SocialAccount data
 * @returns ProcessResult with upload count and errors
 */
async function processScheduledPosts(
  posts: (Post & {
    PlatformPost: (PlatformPost & {
      SocialAccount: SocialAccount;
    })[];
  })[],
): Promise<{ uploaded: number; errors: string[] }> {
  let uploaded = 0;
  const errors: string[] = [];

  for (const post of posts) {
    for (const platformPost of post.PlatformPost) {
      try {
        const result = await uploadToTikTok(post, platformPost, platformPost.SocialAccount);

        if (result.success) {
          uploaded++;
          // Requirement 11.4: Log TikTok API response with status code and publish_id
          console.log("[processScheduledPosts] Upload successful:", {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            publishId: result.publishId,
            timestamp: new Date().toISOString(),
          });
        } else if (result.shouldSkip) {
          // Non-fatal error (rate limit, etc.) - log but don't count as error
          console.warn("[processScheduledPosts] Upload skipped:", {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            reason: result.error,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Fatal error - add to errors array
          errors.push(`Post ${post.id}: ${result.error}`);
          // Requirement 11.5: Log all errors with full context
          console.error("[processScheduledPosts] Upload failed:", {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Post ${post.id}: ${errorMessage}`);
        // Requirement 11.5: Log all errors with full context (userId, postId, error message, stack trace)
        console.error("[processScheduledPosts] Unexpected error:", {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return { uploaded, errors };
}

/**
 * Handle TikTok API upload errors with appropriate retry logic
 *
 * This function implements the error handling strategy for TikTok API errors:
 * - HTTP 400: Mark as FAILED (no retry)
 * - HTTP 401/403: Attempt token refresh and retry once
 * - HTTP 429: Log error and skip (retry on next cron run)
 * - HTTP 5xx: Increment retryCount, mark as FAILED if > 3
 * - Network timeout: Increment retryCount, mark as FAILED if > 3
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.2, 15.3
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record
 * @param uploadResult - The failed upload result
 * @returns UploadResult indicating how to handle the error
 */
async function handleUploadError(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
  uploadResult: UploadVideoResponse,
): Promise<UploadResult> {
  const prisma = getPrisma();
  const errorCode = uploadResult.errorCode || "unknown_error";
  const errorMessage = uploadResult.error || "TikTok API error";

  // Requirement 7.1: HTTP 400 - Mark as FAILED with error message (no retry)
  if (errorCode === "bad_request") {
    // Requirement 11.5: Log all errors with full context
    console.error("[handleUploadError] Bad request error (HTTP 400):", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }

  // Requirement 7.2: HTTP 401/403 - Attempt token refresh and retry once
  if (errorCode === "auth_error") {
    // Requirement 11.7: Log token refresh attempts
    console.warn(
      "[handleUploadError] Authentication error (HTTP 401/403), attempting token refresh:",
      {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      },
    );

    const refreshResult = await refreshToken(socialAccount);

    if (!refreshResult.success) {
      // Requirement 11.7: Log token refresh results
      console.error("[handleUploadError] Token refresh failed after auth error:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      });

      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        "Token refresh failed after authentication error",
      );

      return {
        success: false,
        error: "Token refresh failed after authentication error",
      };
    }

    // Retry upload once with refreshed token
    // Requirement 11.7: Log token refresh results
    console.log("[handleUploadError] Retrying upload with refreshed token:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      timestamp: new Date().toISOString(),
    });

    // Recursively call uploadToTikTok with updated account
    // Note: This will only retry once because the token is now fresh
    return await uploadToTikTok(post, platformPost, refreshResult.updatedAccount!);
  }

  // Requirement 7.3: HTTP 429 - Log error and skip until next cron run
  if (errorCode === "rate_limit") {
    console.warn("[handleUploadError] TikTok API rate limit exceeded (HTTP 429):", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // Leave status as PENDING for retry on next cron run
    return {
      success: false,
      shouldSkip: true,
      error: "TikTok API rate limit exceeded",
    };
  }

  // Requirements 7.4, 7.5: HTTP 5xx or timeout - Increment retryCount
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    const currentRetryCount = platformPost.retryCount;
    const newRetryCount = currentRetryCount + 1;

    // Requirement 11.5: Log all errors with full context
    console.warn("[handleUploadError] Retryable error occurred:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      errorCode,
      error: errorMessage,
      currentRetryCount,
      newRetryCount,
      timestamp: new Date().toISOString(),
    });

    // Increment retry count
    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        retryCount: newRetryCount,
        updatedAt: new Date(),
      },
    });

    // Requirement 7.4: If retryCount > 3, mark as FAILED
    if (newRetryCount > 3) {
      // Requirement 11.5: Log all errors with full context
      console.error("[handleUploadError] Max retries exceeded:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        retryCount: newRetryCount,
        timestamp: new Date().toISOString(),
      });

      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        `${errorMessage} (max retries exceeded)`,
      );

      return {
        success: false,
        error: `${errorMessage} (max retries exceeded)`,
      };
    }

    // Requirement 7.6: Leave status as PENDING for retry on next cron run
    console.log("[handleUploadError] Will retry on next cron run:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      retryCount: newRetryCount,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      shouldSkip: true,
      error: `${errorMessage} (will retry, attempt ${newRetryCount}/3)`,
    };
  }

  // Unknown error - treat as non-retryable
  // Requirement 11.5: Log all errors with full context
  console.error("[handleUploadError] Unknown error type:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    errorCode,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });

  await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * Upload a single post to TikTok
 *
 * This function handles the complete upload flow for a single post:
 * 1. Retrieve and decrypt access token
 * 2. Check if token is expired and refresh if needed
 * 3. Check upload rate limit
 * 4. Generate signed Backblaze URL
 * 5. Call TikTok API to upload video
 * 6. Update database with publish_id and status
 * 7. Increment rate limit counter
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5,
 *               6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 9.2, 9.4
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record with encrypted tokens
 * @returns UploadResult indicating success or failure
 */
async function uploadToTikTok(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
): Promise<UploadResult> {
  // Step 1: Check if access token is expired and refresh if needed
  // Requirements: 5.3, 5.4, 5.5, 5.6, 5.7
  let currentSocialAccount = socialAccount;

  if (isTokenExpired(socialAccount)) {
    // Requirement 11.7: Log token refresh attempts
    console.log("[uploadToTikTok] Token expired, refreshing:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      expiresAt: socialAccount.expiresAt,
      timestamp: new Date().toISOString(),
    });

    const refreshResult = await refreshToken(socialAccount);

    if (!refreshResult.success) {
      // Token refresh failed - mark as FAILED
      // Requirement: 5.7
      await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, "Token refresh failed");

      return {
        success: false,
        error: "Token refresh failed",
      };
    }

    // Use the updated account with new tokens
    currentSocialAccount = refreshResult.updatedAccount!;

    // Requirement 11.7: Log token refresh results
    console.log("[uploadToTikTok] Token refreshed successfully:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  // Requirement: 5.2
  // Requirement 11.6: NEVER log plaintext access tokens
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    // Requirement 11.5: Log all errors with full context
    console.error("[uploadToTikTok] Failed to decrypt access token:", {
      userId: post.userId,
      postId: post.id,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      "Failed to decrypt access token",
    );

    return {
      success: false,
      error: "Failed to decrypt access token",
    };
  }

  // Step 3: Check upload rate limit
  // Requirements: 9.2, 9.4
  const rateLimitResult = await checkUploadRateLimit(post.userId);

  if (!rateLimitResult.allowed) {
    console.warn("[uploadToTikTok] Upload rate limit exceeded:", {
      userId: post.userId,
      postId: post.id,
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      shouldSkip: true,
      error: "Upload rate limit exceeded",
    };
  }

  // Step 4: Generate signed Backblaze URL
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
  let signedUrl: string;
  try {
    const urlResult = await buildSignedVideoUrl(post.videoFileKey);
    signedUrl = urlResult.signedUrl;

    console.log("[uploadToTikTok] Generated signed URL:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      expiresAt: urlResult.expiresAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[uploadToTikTok] Failed to generate signed URL:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      "Failed to generate signed video URL",
    );

    return {
      success: false,
      error: "Failed to generate signed video URL",
    };
  }

  // Step 5: Call TikTok API to upload video
  // Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11
  // Requirement 11.3: Log each TikTok API request with userId, postId, endpoint
  console.log("[uploadToTikTok] Calling TikTok API:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    endpoint: "/v2/post/publish/video/init/",
    timestamp: new Date().toISOString(),
  });

  // Combine title and description for TikTok
  // TikTok API uses 'title' field for the video caption
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title;

  const uploadResult = await uploadVideo({
    accessToken,
    videoUrl: signedUrl,
    title: caption,
    privacyLevel: "SELF_ONLY", // Required for unaudited TikTok apps
    disableComment: false,
    disableDuet: false,
    disableStitch: false,
  });

  // Requirement 11.4: Log each TikTok API response with status code and publish_id
  console.log("[uploadToTikTok] TikTok API response:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    success: uploadResult.success,
    publishId: uploadResult.publishId,
    errorCode: uploadResult.errorCode,
    timestamp: new Date().toISOString(),
  });

  if (!uploadResult.success) {
    // Handle TikTok API errors with appropriate retry logic
    // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.2, 15.3
    return await handleUploadError(post, platformPost, socialAccount, uploadResult);
  }

  // Step 6: Update database with publish_id and status
  // Requirements: 6.10, 6.11
  await updatePlatformPostStatus(platformPost.id, "PUBLISHING", uploadResult.publishId);

  // Step 7: Increment upload rate limit counter
  // Requirement: 9.4
  await incrementUploadCounter(post.userId);

  return {
    success: true,
    publishId: uploadResult.publishId,
  };
}

/**
 * Process publishing posts for status polling
 *
 * This function queries for PlatformPost records with status=PUBLISHING and polls
 * TikTok API for their current status. Based on the status, it updates the database
 * accordingly.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.3, 9.4
 *
 * @returns ProcessResult with polled count and errors
 */
async function processPublishingPosts(): Promise<{ polled: number; errors: string[] }> {
  const prisma = getPrisma();
  let polled = 0;
  const errors: string[] = [];

  try {
    // Query for PlatformPost records with status=PUBLISHING and platform=TikTok
    // Requirement: 8.1
    const publishingPosts = await prisma.platformPost.findMany({
      where: {
        status: "PUBLISHING",
        publishId: {
          not: null,
        },
        SocialAccount: {
          platform: "TikTok",
          isActive: true,
        },
      },
      include: {
        SocialAccount: true,
        Post: true,
      },
    });

    console.log("[processPublishingPosts] Found publishing posts:", {
      count: publishingPosts.length,
      timestamp: new Date().toISOString(),
    });

    // Process each publishing post
    for (const platformPost of publishingPosts) {
      try {
        // Check if the post has been in PUBLISHING status for more than 10 minutes
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const updatedAt = new Date(platformPost.updatedAt);

        if (updatedAt < tenMinutesAgo) {
          // Safety timeout: If polling times out after 10 minutes, mark as FAILED
          console.error("[processPublishingPosts] Polling timeout (10 minutes exceeded):", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            publishId: platformPost.publishId,
            updatedAt: platformPost.updatedAt,
            timestamp: new Date().toISOString(),
          });

          await updatePlatformPostStatus(
            platformPost.id,
            "FAILED",
            undefined,
            "Upload timeout (10 minutes exceeded)",
          );

          // Sync post status after marking as FAILED
          await syncPostStatus(platformPost.postId);

          errors.push(`Post ${platformPost.postId}: Upload timeout`);
          continue;
        }

        const result = await pollUploadStatus(platformPost, platformPost.SocialAccount);

        if (result.success && result.statusUpdated) {
          polled++;
          // Requirement 11.4: Log TikTok API response with status code
          console.log("[processPublishingPosts] Status poll successful:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            publishId: platformPost.publishId,
            timestamp: new Date().toISOString(),
          });
        } else if (result.shouldSkip) {
          // Non-fatal error (rate limit, etc.) - log but don't count as error
          console.warn("[processPublishingPosts] Status poll skipped:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            reason: result.error,
            timestamp: new Date().toISOString(),
          });
        } else if (!result.success) {
          // Fatal error - add to errors array
          errors.push(`Post ${platformPost.postId}: ${result.error}`);
          // Requirement 11.5: Log all errors with full context
          console.error("[processPublishingPosts] Status poll failed:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Post ${platformPost.postId}: ${errorMessage}`);
        // Requirement 11.5: Log all errors with full context (userId, postId, error message, stack trace)
        console.error("[processPublishingPosts] Unexpected error:", {
          userId: platformPost.Post.userId,
          postId: platformPost.postId,
          platformPostId: platformPost.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { polled, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[processPublishingPosts] Database query error:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return { polled: 0, errors: [errorMessage] };
  }
}

/**
 * Update the status of a PlatformPost record
 *
 * This function updates a PlatformPost record with new status, publishId, platformPostId,
 * platformUrl, and error message. It uses a database transaction to ensure atomic updates.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.2, 14.3, 14.4
 *
 * @param platformPostId - The ID of the PlatformPost to update
 * @param status - The new status to set
 * @param publishId - Optional TikTok publish_id
 * @param errorMessage - Optional error message for FAILED status
 * @param tiktokPostId - Optional TikTok post ID (from publicaly_available_post_id)
 * @param tiktokUrl - Optional TikTok post URL
 * @returns Promise<void>
 */
async function updatePlatformPostStatus(
  platformPostId: string,
  status: PlatformPostStatus,
  publishId?: string,
  errorMessage?: string,
  tiktokPostId?: string,
  tiktokUrl?: string,
): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic update
    // Requirement: 14.1, 14.2
    await prisma.$transaction(async (tx) => {
      const updateData: {
        status: PlatformPostStatus;
        updatedAt: Date;
        publishId?: string;
        errorMessage?: string | null;
        publishedAt?: Date;
        platformPostId?: string;
        platformUrl?: string;
      } = {
        status,
        updatedAt: new Date(),
      };

      // Add publishId if provided
      if (publishId !== undefined) {
        updateData.publishId = publishId;
      }

      // Add platformPostId if provided
      if (tiktokPostId !== undefined) {
        updateData.platformPostId = tiktokPostId;
      }

      // Add platformUrl if provided
      if (tiktokUrl !== undefined) {
        updateData.platformUrl = tiktokUrl;
      }

      // Add errorMessage if provided (or clear it if null)
      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      } else if (status === "PUBLISHED") {
        // Clear error message on successful publish
        updateData.errorMessage = null;
      }

      // Set publishedAt timestamp when status becomes PUBLISHED
      if (status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }

      await tx.platformPost.update({
        where: { id: platformPostId },
        data: updateData,
      });
    });

    console.log("[updatePlatformPostStatus] Status updated:", {
      platformPostId,
      status,
      publishId,
      tiktokPostId,
      tiktokUrl,
      hasError: !!errorMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Requirement: 14.3, 14.4
    console.error("[updatePlatformPostStatus] Transaction failed:", {
      platformPostId,
      status,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Synchronize Post status based on all PlatformPost records
 *
 * This function calculates the Post status based on all associated PlatformPost records:
 * - All PUBLISHED → PUBLISHED
 * - All FAILED → FAILED
 * - Any PUBLISHING → PUBLISHING
 * - Mix of PUBLISHED and FAILED → PARTIALLY_PUBLISHED
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.2, 14.3, 14.4
 *
 * @param postId - The ID of the Post to synchronize
 * @returns Promise<void>
 */
async function syncPostStatus(postId: string): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic read and update
    // Requirement: 14.1, 14.2
    await prisma.$transaction(async (tx) => {
      // Get all PlatformPost records for this Post
      const platformPosts = await tx.platformPost.findMany({
        where: { postId },
        select: { status: true },
      });

      if (platformPosts.length === 0) {
        console.warn("[syncPostStatus] No PlatformPost records found:", {
          postId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Extract statuses
      const statuses = platformPosts.map((pp) => pp.status);

      // Calculate Post status based on PlatformPost statuses
      // Requirements: 10.1, 10.2, 10.3, 10.4
      let newPostStatus: PostStatus;

      // All published → PUBLISHED
      // Requirement: 10.1
      if (statuses.every((s) => s === "PUBLISHED")) {
        newPostStatus = "PUBLISHED";
      }
      // All failed → FAILED
      // Requirement: 10.3
      else if (statuses.every((s) => s === "FAILED")) {
        newPostStatus = "FAILED";
      }
      // Any publishing → PUBLISHING
      // Requirement: 10.4
      else if (statuses.some((s) => s === "PUBLISHING")) {
        newPostStatus = "PUBLISHING";
      }
      // Mix of published and failed → PARTIALLY_PUBLISHED
      // Requirement: 10.2
      else if (statuses.some((s) => s === "PUBLISHED") && statuses.some((s) => s === "FAILED")) {
        newPostStatus = "PARTIALLY_PUBLISHED";
      }
      // All pending → SCHEDULED (default)
      else {
        newPostStatus = "SCHEDULED";
      }

      // Update Post status and updatedAt timestamp
      // Requirement: 10.5
      await tx.post.update({
        where: { id: postId },
        data: {
          status: newPostStatus,
          updatedAt: new Date(),
        },
      });

      console.log("[syncPostStatus] Post status synchronized:", {
        postId,
        platformPostCount: platformPosts.length,
        platformStatuses: statuses,
        newPostStatus,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    // Requirement: 14.3, 14.4
    console.error("[syncPostStatus] Transaction failed:", {
      postId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Handle TikTok API status polling errors with appropriate retry logic
 *
 * This function implements the error handling strategy for TikTok API status polling errors:
 * - HTTP 400: Log error and skip (invalid publishId)
 * - HTTP 401/403: Attempt token refresh and retry once
 * - HTTP 429: Log error and skip (retry on next cron run)
 * - HTTP 5xx: Log error and skip (retry on next cron run)
 * - Network timeout: Log error and skip (retry on next cron run)
 *
 * Note: For status polling, we don't mark as FAILED on errors because the upload
 * may still be processing. We just skip and retry on the next cron run.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.2, 15.3
 *
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record
 * @param pollResult - The failed poll result
 * @returns StatusResult indicating how to handle the error
 */
async function handlePollError(
  platformPost: PlatformPost & { Post: Post },
  socialAccount: SocialAccount,
  pollResult: PollStatusResponse,
): Promise<StatusResult> {
  const errorCode = pollResult.errorCode || "unknown_error";
  const errorMessage = pollResult.error || "TikTok API error";

  // Requirement 7.1: HTTP 400 - Log error and skip (invalid publishId)
  if (errorCode === "bad_request") {
    // Requirement 11.5: Log all errors with full context
    console.error("[handlePollError] Bad request error (HTTP 400):", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      publishId: platformPost.publishId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // For polling, we don't mark as FAILED immediately - might be temporary
    return {
      success: false,
      shouldSkip: true,
      error: errorMessage,
    };
  }

  // Requirement 7.2: HTTP 401/403 - Attempt token refresh and retry once
  if (errorCode === "auth_error") {
    // Requirement 11.7: Log token refresh attempts
    console.warn(
      "[handlePollError] Authentication error (HTTP 401/403), attempting token refresh:",
      {
        userId: platformPost.Post.userId,
        postId: platformPost.postId,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      },
    );

    const refreshResult = await refreshToken(socialAccount);

    if (!refreshResult.success) {
      // Requirement 11.7: Log token refresh results
      console.error("[handlePollError] Token refresh failed after auth error:", {
        userId: platformPost.Post.userId,
        postId: platformPost.postId,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        shouldSkip: true,
        error: "Token refresh failed after authentication error",
      };
    }

    // Retry poll once with refreshed token
    // Requirement 11.7: Log token refresh results
    console.log("[handlePollError] Retrying poll with refreshed token:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      timestamp: new Date().toISOString(),
    });

    // Recursively call pollUploadStatus with updated account
    return await pollUploadStatus(platformPost, refreshResult.updatedAccount!);
  }

  // Requirement 7.3: HTTP 429 - Log error and skip until next cron run
  if (errorCode === "rate_limit") {
    console.warn("[handlePollError] TikTok API rate limit exceeded (HTTP 429):", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      shouldSkip: true,
      error: "TikTok API rate limit exceeded",
    };
  }

  // Requirements 7.4, 7.5, 7.6: HTTP 5xx, timeout, or network error - Skip and retry on next cron run
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    // Requirement 11.5: Log all errors with full context
    console.warn("[handlePollError] Retryable error occurred:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      errorCode,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // For polling, we don't increment retry count - just skip and retry on next cron run
    return {
      success: false,
      shouldSkip: true,
      error: `${errorMessage} (will retry on next cron run)`,
    };
  }

  // Unknown error - skip and retry
  // Requirement 11.5: Log all errors with full context
  console.error("[handlePollError] Unknown error type:", {
    userId: platformPost.Post.userId,
    postId: platformPost.postId,
    platformPostId: platformPost.id,
    errorCode,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });

  return {
    success: false,
    shouldSkip: true,
    error: errorMessage,
  };
}

/**
 * Poll the upload status for a single PlatformPost
 *
 * This function handles the complete status polling flow:
 * 1. Retrieve and decrypt access token
 * 2. Check if token is expired and refresh if needed
 * 3. Check status poll rate limit
 * 4. Call TikTok API to poll status
 * 5. Update database based on status
 * 6. Increment rate limit counter
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.3, 9.4
 *
 * @param platformPost - The PlatformPost record with publishId
 * @param socialAccount - The SocialAccount record with encrypted tokens
 * @returns StatusResult indicating success or failure
 */
async function pollUploadStatus(
  platformPost: PlatformPost & { Post: Post },
  socialAccount: SocialAccount,
): Promise<StatusResult> {
  // Step 1: Check if access token is expired and refresh if needed
  let currentSocialAccount = socialAccount;

  if (isTokenExpired(socialAccount)) {
    // Requirement 11.7: Log token refresh attempts
    console.log("[pollUploadStatus] Token expired, refreshing:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platform: socialAccount.platform,
      expiresAt: socialAccount.expiresAt,
      timestamp: new Date().toISOString(),
    });

    const refreshResult = await refreshToken(socialAccount);

    if (!refreshResult.success) {
      // Token refresh failed - mark as FAILED
      await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, "Token refresh failed");

      return {
        success: false,
        error: "Token refresh failed",
      };
    }

    // Use the updated account with new tokens
    currentSocialAccount = refreshResult.updatedAccount!;

    // Requirement 11.7: Log token refresh results
    console.log("[pollUploadStatus] Token refreshed successfully:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  // Requirement 11.6: NEVER log plaintext access tokens
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    // Requirement 11.5: Log all errors with full context
    console.error("[pollUploadStatus] Failed to decrypt access token:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      "Failed to decrypt access token",
    );

    return {
      success: false,
      error: "Failed to decrypt access token",
    };
  }

  // Step 3: Check status poll rate limit
  // Requirements: 9.3, 9.4
  const rateLimitResult = await checkStatusPollRateLimit(platformPost.Post.userId);

  if (!rateLimitResult.allowed) {
    console.warn("[pollUploadStatus] Status poll rate limit exceeded:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      shouldSkip: true,
      error: "Status poll rate limit exceeded",
    };
  }

  // Step 4: Call TikTok API to poll status
  // Requirements: 8.2, 8.3, 8.4, 8.5
  if (!platformPost.publishId) {
    // Requirement 11.5: Log all errors with full context
    console.error("[pollUploadStatus] Missing publishId:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: "Missing publishId",
    };
  }

  // Requirement 11.3: Log each TikTok API request with userId, postId, endpoint
  console.log("[pollUploadStatus] Calling TikTok API:", {
    userId: platformPost.Post.userId,
    postId: platformPost.postId,
    platformPostId: platformPost.id,
    publishId: platformPost.publishId,
    endpoint: "/v2/post/publish/status/fetch/",
    timestamp: new Date().toISOString(),
  });

  const pollResult = await pollStatus({
    accessToken,
    publishId: platformPost.publishId,
  });

  // Requirement 11.4: Log each TikTok API response with status code
  console.log("[pollUploadStatus] TikTok API response:", {
    userId: platformPost.Post.userId,
    postId: platformPost.postId,
    platformPostId: platformPost.id,
    success: pollResult.success,
    status: pollResult.status,
    errorCode: pollResult.errorCode,
    timestamp: new Date().toISOString(),
  });

  if (!pollResult.success) {
    // Handle TikTok API errors with appropriate retry logic
    // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.2, 15.3
    return await handlePollError(platformPost, socialAccount, pollResult);
  }

  // Step 5: Update database based on status
  // Requirements: 8.3, 8.4, 8.5
  let statusUpdated = false;

  if (pollResult.status === "PUBLISH_COMPLETE") {
    // Requirement: 8.3
    // Extract TikTok post ID and construct URL
    let tiktokPostId: string | undefined;
    let tiktokUrl: string | undefined;

    if (pollResult.publiclyAvailablePostIds && pollResult.publiclyAvailablePostIds.length > 0) {
      tiktokPostId = pollResult.publiclyAvailablePostIds[0];
      // Construct TikTok URL: https://www.tiktok.com/@username/video/{postId}
      // Note: We don't have the username here, so we'll use a generic format
      // The URL can be updated later if needed
      tiktokUrl = `https://www.tiktok.com/video/${tiktokPostId}`;

      console.log("[pollUploadStatus] Extracted TikTok post details:", {
        userId: platformPost.Post.userId,
        postId: platformPost.postId,
        platformPostId: platformPost.id,
        tiktokPostId,
        tiktokUrl,
        timestamp: new Date().toISOString(),
      });
    }

    await updatePlatformPostStatus(
      platformPost.id,
      "PUBLISHED",
      undefined,
      undefined,
      tiktokPostId,
      tiktokUrl,
    );
    statusUpdated = true;

    console.log("[pollUploadStatus] Post published successfully:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      publishId: platformPost.publishId,
      tiktokPostId,
      tiktokUrl,
      timestamp: new Date().toISOString(),
    });
  } else if (pollResult.status === "FAILED") {
    // Requirement: 8.4
    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      pollResult.failReason || "TikTok processing failed",
    );
    statusUpdated = true;

    console.error("[pollUploadStatus] Post failed on TikTok:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      publishId: platformPost.publishId,
      failReason: pollResult.failReason,
      timestamp: new Date().toISOString(),
    });
  } else if (
    pollResult.status === "PROCESSING_DOWNLOAD" ||
    pollResult.status === "PROCESSING_UPLOAD"
  ) {
    // Requirement: 8.5
    // Leave status as PUBLISHING - no update needed
    console.log("[pollUploadStatus] Post still processing:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      publishId: platformPost.publishId,
      status: pollResult.status,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 6: Increment status poll rate limit counter
  // Requirement: 9.4
  await incrementStatusPollCounter(platformPost.Post.userId);

  return {
    success: true,
    statusUpdated,
  };
}
