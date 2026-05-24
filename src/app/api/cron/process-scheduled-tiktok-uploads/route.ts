/**
 * Scheduled TikTok Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * TikTok uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Uploading videos to TikTok 
 * - Polling upload status
 * - Updating database records
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
import {
  createNotification,
  formatUploadSuccess,
  formatUploadFailed,
} from "@/lib/notifications";

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
 * 3. Processes uploads and status polling
 * 4. Returns a summary of operations
 *
 * @param {NextRequest} request - The incoming request from cron-job.org
 * @returns {Promise<NextResponse>} Response with processing summary or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET
  // .2, 3.3
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-tiktok-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  //  Log cron execution start with timestamp
  console.log("[process-scheduled-tiktok-uploads] Cron execution started:", {
    timestamp: new Date().toISOString(),
  });

  try {
    const prisma = getPrisma();
    const window = getSchedulingWindow();

    // Query for scheduled posts within the scheduling window
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
    // 
    const postsToProcess = scheduledPosts.filter((post) => post.PlatformPost.length > 0);

    //  Log count of posts found in scheduling window
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
    //  - Implement upload processing logic
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Process publishing posts for status polling
    //  - Implement status polling logic
    const pollResult = await processPublishingPosts();
    result.polled = pollResult.polled;
    result.errors.push(...pollResult.errors);

    // Sync Post status for all processed posts
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

    //  Log cron execution end with timestamp
    console.log("[process-scheduled-tiktok-uploads] Cron execution completed:", {
      timestamp: new Date().toISOString(),
      result,
    });

    // Return HTTP 200 with summary
    // 
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Return HTTP 500 on database errors
    // 
    //  Log all errors with full context
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
          //  Log TikTok API response with status code and publish_id
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
          //  Log all errors with full context
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
        //  Log all errors with full context (userId, postId, error message, stack trace)
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

  //  HTTP 400 - Mark as FAILED with error message (no retry)
  if (errorCode === "bad_request") {
    //  Log all errors with full context
    console.error("[handleUploadError] Bad request error (HTTP 400):", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

    // Create notification for failed upload
    await createFailedUploadNotificationById(post.id, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }

  //  HTTP 401/403 - Attempt token refresh and retry once
  if (errorCode === "auth_error") {
    //  Log token refresh attempts
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
      //  Log token refresh results
      console.error("[handleUploadError] Token refresh failed after auth error:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      });

      const authError = "Token refresh failed after authentication error";
      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        authError,
      );

      // Create notification for failed upload
      await createFailedUploadNotificationById(post.id, authError);

      return {
        success: false,
        error: authError,
      };
    }

    // Retry upload once with refreshed token
    //  Log token refresh results
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

  //  HTTP 429 - Log error and skip until next cron run
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

  //  HTTP 5xx or timeout - Increment retryCount
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    const currentRetryCount = platformPost.retryCount;
    const newRetryCount = currentRetryCount + 1;

    //  Log all errors with full context
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

    //  If retryCount > 3, mark as FAILED
    if (newRetryCount > 3) {
      //  Log all errors with full context
      console.error("[handleUploadError] Max retries exceeded:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        retryCount: newRetryCount,
        timestamp: new Date().toISOString(),
      });

      const maxRetriesError = `${errorMessage} (max retries exceeded)`;
      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        maxRetriesError,
      );

      // Create notification for failed upload
      await createFailedUploadNotificationById(post.id, maxRetriesError);

      return {
        success: false,
        error: maxRetriesError,
      };
    }

    //  Leave status as PENDING for retry on next cron run
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
  //  Log all errors with full context
  console.error("[handleUploadError] Unknown error type:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    errorCode,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });

  await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

  // Create notification for failed upload
  await createFailedUploadNotificationById(post.id, errorMessage);

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
  // .3, 5.4, 5.5, 5.6, 5.7
  let currentSocialAccount = socialAccount;

  if (isTokenExpired(socialAccount)) {
    //  Log token refresh attempts
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
      // 
      const tokenError = "Token refresh failed";
      await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, tokenError);

      // Create notification for failed upload
      await createFailedUploadNotificationById(post.id, tokenError);

      return {
        success: false,
        error: tokenError,
      };
    }

    // Use the updated account with new tokens
    currentSocialAccount = refreshResult.updatedAccount!;

    //  Log token refresh results
    console.log("[uploadToTikTok] Token refreshed successfully:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  // 
  //  NEVER log plaintext access tokens
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    //  Log all errors with full context
    console.error("[uploadToTikTok] Failed to decrypt access token:", {
      userId: post.userId,
      postId: post.id,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    const decryptError = "Failed to decrypt access token";
    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      decryptError,
    );

    // Create notification for failed upload
    await createFailedUploadNotificationById(post.id, decryptError);

    return {
      success: false,
      error: decryptError,
    };
  }

  // Step 3: Check upload rate limit
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

    const urlError = "Failed to generate signed video URL";
    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      urlError,
    );

    // Create notification for failed upload
    await createFailedUploadNotificationById(post.id, urlError);

    return {
      success: false,
      error: urlError,
    };
  }

  // Step 5: Call TikTok API to upload video
  //  Log each TikTok API request with userId, postId, endpoint
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

  //  Log each TikTok API response with status code and publish_id
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
    return await handleUploadError(post, platformPost, socialAccount, uploadResult);
  }

  // Step 6: Update database with publish_id and status
  await updatePlatformPostStatus(platformPost.id, "PUBLISHING", uploadResult.publishId);

  // Step 7: Increment upload rate limit counter
  // 
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
 * @returns ProcessResult with polled count and errors
 */
async function processPublishingPosts(): Promise<{ polled: number; errors: string[] }> {
  const prisma = getPrisma();
  let polled = 0;
  const errors: string[] = [];

  try {
    // Query for PlatformPost records with status=PUBLISHING and platform=TikTok
    // 
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

          const timeoutError = "Upload timeout (10 minutes exceeded)";
          await updatePlatformPostStatus(
            platformPost.id,
            "FAILED",
            undefined,
            timeoutError,
          );

          // Create notification for failed upload
          await createFailedUploadNotification(platformPost, timeoutError);

          // Sync post status after marking as FAILED
          await syncPostStatus(platformPost.postId);

          errors.push(`Post ${platformPost.postId}: Upload timeout`);
          continue;
        }

        const result = await pollUploadStatus(platformPost, platformPost.SocialAccount);

        if (result.success && result.statusUpdated) {
          polled++;
          //  Log TikTok API response with status code
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
          //  Log all errors with full context
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
        //  Log all errors with full context (userId, postId, error message, stack trace)
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
 * @param postId - The ID of the Post to synchronize
 * @returns Promise<void>
 */
async function syncPostStatus(postId: string): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic read and update
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
      let newPostStatus: PostStatus;

      // All published → PUBLISHED
      // 
      if (statuses.every((s) => s === "PUBLISHED")) {
        newPostStatus = "PUBLISHED";
      }
      // All failed → FAILED
      // 
      else if (statuses.every((s) => s === "FAILED")) {
        newPostStatus = "FAILED";
      }
      // Any publishing → PUBLISHING
      // 
      else if (statuses.some((s) => s === "PUBLISHING")) {
        newPostStatus = "PUBLISHING";
      }
      // Mix of published and failed → PARTIALLY_PUBLISHED
      // 
      else if (statuses.some((s) => s === "PUBLISHED") && statuses.some((s) => s === "FAILED")) {
        newPostStatus = "PARTIALLY_PUBLISHED";
      }
      // All pending → SCHEDULED (default)
      else {
        newPostStatus = "SCHEDULED";
      }

      // Update Post status and updatedAt timestamp
      // 
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

  //  HTTP 400 - Log error and skip (invalid publishId)
  if (errorCode === "bad_request") {
    //  Log all errors with full context
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

  //  HTTP 401/403 - Attempt token refresh and retry once
  if (errorCode === "auth_error") {
    //  Log token refresh attempts
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
      //  Log token refresh results
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
    //  Log token refresh results
    console.log("[handlePollError] Retrying poll with refreshed token:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platformPostId: platformPost.id,
      timestamp: new Date().toISOString(),
    });

    // Recursively call pollUploadStatus with updated account
    return await pollUploadStatus(platformPost, refreshResult.updatedAccount!);
  }

  //  HTTP 429 - Log error and skip until next cron run
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

  // HTTP 5xx, timeout, or network error - Skip and retry on next cron run
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    //  Log all errors with full context
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
  //  Log all errors with full context
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
    //  Log token refresh attempts
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

    //  Log token refresh results
    console.log("[pollUploadStatus] Token refreshed successfully:", {
      userId: platformPost.Post.userId,
      postId: platformPost.postId,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  //  NEVER log plaintext access tokens
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    //  Log all errors with full context
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
  if (!platformPost.publishId) {
    //  Log all errors with full context
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

  //  Log each TikTok API request with userId, postId, endpoint
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

  //  Log each TikTok API response with status code
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
    return await handlePollError(platformPost, socialAccount, pollResult);
  }

  // Step 5: Update database based on status
  let statusUpdated = false;

  if (pollResult.status === "PUBLISH_COMPLETE") {
    // 
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

    // Create notification for successful upload
    await createSuccessUploadNotification(platformPost);
  } else if (pollResult.status === "FAILED") {
    // 
    const failReason = pollResult.failReason || "TikTok processing failed";
    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      failReason,
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

    // Create notification for failed upload
    await createFailedUploadNotification(platformPost, failReason);
  } else if (
    pollResult.status === "PROCESSING_DOWNLOAD" ||
    pollResult.status === "PROCESSING_UPLOAD"
  ) {
    // 
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
  // 
  await incrementStatusPollCounter(platformPost.Post.userId);

  return {
    success: true,
    statusUpdated,
  };
}

/**
 * Create a notification for a failed upload
 *
 * This helper function creates a notification when an upload fails.
 * It wraps the notification creation in a try-catch to ensure that
 * notification failures don't break the upload processing flow.
 *
 * @param platformPost - The PlatformPost with Post data
 * @param errorMessage - The error message describing the failure
 */
async function createFailedUploadNotification(
  platformPost: PlatformPost & { Post: Post },
  errorMessage: string
): Promise<void> {
  try {
    const notificationContent = formatUploadFailed(
      platformPost.Post.title,
      "TikTok",
      errorMessage
    );
    await createNotification(
      platformPost.Post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_FAILED"
    );
  } catch (notificationError) {
    console.error("[createFailedUploadNotification] Failed to create failure notification:", {
      platformPostId: platformPost.id,
      postId: platformPost.postId,
      userId: platformPost.Post.userId,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a notification for a successful upload
 *
 * This helper function creates a notification when an upload succeeds.
 * It wraps the notification creation in a try-catch to ensure that
 * notification failures don't break the upload processing flow.
 *
 * @param platformPost - The PlatformPost with Post data
 */
async function createSuccessUploadNotification(
  platformPost: PlatformPost & { Post: Post }
): Promise<void> {
  try {
    const notificationContent = formatUploadSuccess(
      platformPost.Post.title,
      "TikTok"
    );
    await createNotification(
      platformPost.Post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_SUCCESS"
    );
  } catch (notificationError) {
    console.error("[createSuccessUploadNotification] Failed to create success notification:", {
      platformPostId: platformPost.id,
      postId: platformPost.postId,
      userId: platformPost.Post.userId,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a notification for a failed upload using postId
 *
 * This helper function creates a notification when an upload fails.
 * It queries the Post by ID to get the title and userId.
 * It wraps the notification creation in a try-catch to ensure that
 * notification failures don't break the upload processing flow.
 *
 * @param postId - The ID of the Post
 * @param errorMessage - The error message describing the failure
 */
async function createFailedUploadNotificationById(
  postId: string,
  errorMessage: string
): Promise<void> {
  try {
    const prisma = getPrisma();
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, userId: true },
    });

    if (!post) {
      console.error("[createFailedUploadNotificationById] Post not found:", {
        postId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const notificationContent = formatUploadFailed(
      post.title,
      "TikTok",
      errorMessage
    );
    await createNotification(
      post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_FAILED"
    );
  } catch (notificationError) {
    console.error("[createFailedUploadNotificationById] Failed to create failure notification:", {
      postId,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
