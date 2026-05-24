/**
 * Scheduled Instagram Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * Instagram uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Uploading videos to Instagram 
 * - Polling container status
 * - Publishing containers
 * - Updating database records
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount, PlatformPostStatus, PostStatus } from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/encryption";
import { checkUploadRateLimit, incrementUploadCounter } from "@/lib/instagram/rateLimiter";
import { buildSignedVideoUrl } from "@/lib/backblaze/urlBuilder";
import {
  createMediaContainer,
  CreateContainerResponse,
  pollContainerStatus,
  publishContainer,
} from "@/lib/instagram/api";
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
  errors: string[];
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
    console.error("[process-scheduled-instagram-uploads] No Authorization header");
    return false;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[process-scheduled-instagram-uploads] CRON_SECRET not configured");
    return false;
  }

  // Debug logging (safe - only logs lengths and first/last 4 chars)
  console.log("[process-scheduled-instagram-uploads] Auth debug:", {
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
 * POST /api/cron/process-scheduled-instagram-uploads
 *
 * Main handler for processing scheduled Instagram uploads. This endpoint:
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
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-instagram-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Requirement 12.3: Log cron execution start with timestamp
  console.log("[process-scheduled-instagram-uploads] Cron execution started:", {
    timestamp: new Date().toISOString(),
  });

  try {
    const prisma = getPrisma();
    const window = getSchedulingWindow();

    // Query for scheduled posts within the scheduling window
    //  5.4, 5.5, 5.6
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
              platform: "Instagram",
              isActive: true,
            },
          },
          include: {
            SocialAccount: true,
          },
        },
      },
    });

    // Filter to only include posts with Instagram PlatformPost records
    const postsToProcess = scheduledPosts.filter((post) => post.PlatformPost.length > 0);

    // Log count of posts found in scheduling window
    console.log("[process-scheduled-instagram-uploads] Found posts to process:", {
      timestamp: new Date().toISOString(),
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      totalScheduled: scheduledPosts.length,
      withInstagram: postsToProcess.length,
    });

    // Initialize result summary
    const result: ProcessResult = {
      processed: postsToProcess.length,
      uploaded: 0,
      errors: [],
    };

    // Process scheduled posts for upload
    // Implement upload processing logic
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Process publishing posts for status polling and publishing
    // Implement container status polling logic
    const publishingResult = await processPublishingPosts();
    result.errors.push(...publishingResult.errors);

    // Log cron execution end with timestamp
    console.log("[process-scheduled-instagram-uploads] Cron execution completed:", {
      timestamp: new Date().toISOString(),
      result,
    });

    // Return HTTP 200 with summary
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Return HTTP 500 on database errors
    // Log all errors with full context
    console.error("[process-scheduled-instagram-uploads] Database error:", {
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
 * Result of uploading a single post
 */
interface UploadResult {
  success: boolean;
  containerId?: string;
  error?: string;
  shouldSkip?: boolean; // True if rate limited or other non-fatal error
}

/**
 * Process scheduled posts for upload to Instagram
 *
 * This function processes each scheduled post by:
 * 1. Retrieving and decrypting the SocialAccount tokens
 * 2. Checking if the access token is expired and refreshing if needed
 * 3. Checking upload rate limits
 * 4. Generating a signed Backblaze URL for the video
 * 5. Validating video requirements
 * 6. Calling Instagram API to create media container
 * 7. Updating the database with the container ID and status
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
        const result = await uploadToInstagram(post, platformPost, platformPost.SocialAccount);

        if (result.success) {
          uploaded++;
          // Log Instagram API response with status code and container ID
          console.log("[processScheduledPosts] Upload successful:", {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            containerId: result.containerId,
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
          // Log all errors with full context
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
        // Log all errors with full context (userId, postId, error message, stack trace)
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
 * Process publishing posts for container status polling
 *
 * This function processes PlatformPost records with status=PUBLISHING by:
 * 1. Querying database for PUBLISHING posts with platform=Instagram
 * 2. For each post, polling the container status
 * 3. If status is "FINISHED", proceeding to publish step
 * 4. If status is "ERROR", marking as FAILED
 * 5. If polling times out after 5 minutes, marking as FAILED
 *
 * @returns ProcessResult with error count
 */
async function processPublishingPosts(): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  const prisma = getPrisma();

  try {
    // Query database for PlatformPost records with status=PUBLISHING and platform=Instagram
    const publishingPosts = await prisma.platformPost.findMany({
      where: {
        status: "PUBLISHING",
        SocialAccount: {
          platform: "Instagram",
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
        // Check if we have a container ID (publishId)
        if (!platformPost.publishId) {
          console.error("[processPublishingPosts] No container ID found:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            timestamp: new Date().toISOString(),
          });
          await updatePlatformPostStatus(
            platformPost.id,
            "FAILED",
            undefined,
            "No container ID found",
          );

          // Create notification for failed upload
          await createFailedUploadNotification(platformPost, "No container ID found");

          errors.push(`Post ${platformPost.postId}: No container ID found`);
          continue;
        }

        // Check if the post has been in PUBLISHING status for more than 15 minutes
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const updatedAt = new Date(platformPost.updatedAt);

        if (updatedAt < fifteenMinutesAgo) {
          // If polling times out after 15 minutes, mark as FAILED
          console.error("[processPublishingPosts] Polling timeout (15 minutes exceeded):", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            updatedAt: platformPost.updatedAt,
            timestamp: new Date().toISOString(),
          });

          await updatePlatformPostStatus(
            platformPost.id,
            "FAILED",
            undefined,
            "Container processing timeout (15 minutes exceeded)",
          );

          // Create notification for failed upload
          await createFailedUploadNotification(
            platformPost,
            "Container processing timeout (15 minutes exceeded)"
          );

          // Sync post status after marking as FAILED
          await syncPostStatus(platformPost.postId);

          errors.push(`Post ${platformPost.postId}: Container processing timeout`);
          continue;
        }

        // Decrypt access token
        let accessToken: string;
        try {
          accessToken = decryptToken(platformPost.SocialAccount.accessToken);
        } catch (error) {
          console.error("[processPublishingPosts] Failed to decrypt access token:", {
            platformPostId: platformPost.id,
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

          // Create notification for failed upload
          await createFailedUploadNotification(platformPost, "Failed to decrypt access token");

          // Sync post status after marking as FAILED
          await syncPostStatus(platformPost.postId);

          errors.push(`Post ${platformPost.postId}: Failed to decrypt access token`);
          continue;
        }

        // Poll container status
        // Poll container status with container ID
        console.log("[processPublishingPosts] Polling container status:", {
          platformPostId: platformPost.id,
          postId: platformPost.postId,
          containerId: platformPost.publishId,
          timestamp: new Date().toISOString(),
        });

        const statusResult = await pollContainerStatus({
          accessToken,
          containerId: platformPost.publishId,
        });

        // Log status polling attempt
        console.log("[processPublishingPosts] Container status result:", {
          platformPostId: platformPost.id,
          postId: platformPost.postId,
          containerId: platformPost.publishId,
          success: statusResult.success,
          statusCode: statusResult.statusCode,
          timestamp: new Date().toISOString(),
        });

        if (!statusResult.success) {
          // API error occurred
          console.error("[processPublishingPosts] Status polling API error:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            error: statusResult.error,
            errorCode: statusResult.errorCode,
            timestamp: new Date().toISOString(),
          });

          // For auth errors, we could try token refresh, but for now just log and continue
          // The post will be retried on the next cron run
          continue;
        }

        // Check status_code
        if (statusResult.statusCode === "IN_PROGRESS") {
          // Still processing - continue polling on next cron run
          console.log("[processPublishingPosts] Container still processing:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            statusCode: statusResult.statusCode,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        if (statusResult.statusCode === "ERROR") {
          //If status_code is "ERROR", mark as FAILED with error message
          const errorMessage =
            statusResult.errorMessage || "Container processing failed on Instagram";

          console.error("[processPublishingPosts] Container processing error:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            errorMessage,
            timestamp: new Date().toISOString(),
          });

          await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

          // Create notification for failed upload
          await createFailedUploadNotification(platformPost, errorMessage);

          // Sync post status after marking as FAILED
          await syncPostStatus(platformPost.postId);

          errors.push(`Post ${platformPost.postId}: ${errorMessage}`);
          continue;
        }

        if (statusResult.statusCode === "FINISHED") {
          // Container is ready to publish - proceed to publish step
          console.log("[processPublishingPosts] Container ready to publish:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            timestamp: new Date().toISOString(),
          });

          // Call publishContainer to make the video live
          const publishResult = await publishContainer({
            accessToken,
            igUserId: platformPost.SocialAccount.platformAccountId,
            containerId: platformPost.publishId,
          });

          if (!publishResult.success) {
            console.error("[processPublishingPosts] Publish failed:", {
              platformPostId: platformPost.id,
              postId: platformPost.postId,
              containerId: platformPost.publishId,
              error: publishResult.error,
              errorCode: publishResult.errorCode,
              timestamp: new Date().toISOString(),
            });

            // Handle publish errors (could implement retry logic here)
            await updatePlatformPostStatus(
              platformPost.id,
              "FAILED",
              undefined,
              publishResult.error || "Failed to publish container",
            );

            // Create notification for failed upload
            await createFailedUploadNotification(
              platformPost,
              publishResult.error || "Failed to publish container"
            );

            // Sync post status after marking as FAILED
            await syncPostStatus(platformPost.postId);

            errors.push(`Post ${platformPost.postId}: ${publishResult.error}`);
            continue;
          }

          // Publish successful - update status to PUBLISHED
          const mediaId = publishResult.mediaId!;
          const platformUrl = `https://www.instagram.com/p/${mediaId}/`;

          console.log("[processPublishingPosts] Publish successful:", {
            platformPostId: platformPost.id,
            postId: platformPost.postId,
            containerId: platformPost.publishId,
            mediaId,
            platformUrl,
            timestamp: new Date().toISOString(),
          });

          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "PUBLISHED",
              platformPostId: mediaId,
              platformUrl,
              publishedAt: new Date(),
              errorMessage: null,
              updatedAt: new Date(),
            },
          });

          // Create notification for successful upload
          try {
            const notificationContent = formatUploadSuccess(
              platformPost.Post.title,
              "Instagram"
            );
            await createNotification(
              platformPost.Post.userId,
              notificationContent.title,
              notificationContent.description,
              "UPLOAD_SUCCESS"
            );
          } catch (notificationError) {
            console.error("[processPublishingPosts] Failed to create success notification:", {
              platformPostId: platformPost.id,
              postId: platformPost.postId,
              userId: platformPost.Post.userId,
              error: notificationError instanceof Error ? notificationError.message : "Unknown error",
              timestamp: new Date().toISOString(),
            });
          }

          // Sync post status after successful publish
          await syncPostStatus(platformPost.postId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Post ${platformPost.postId}: ${errorMessage}`);

        console.error("[processPublishingPosts] Unexpected error:", {
          platformPostId: platformPost.id,
          postId: platformPost.postId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { errors };
  } catch (error) {
    console.error("[processPublishingPosts] Database query error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return {
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Validate video requirements for Instagram
 *
 * This function validates that the video meets Instagram's : MP4 or MOV (inferred from file extension)
 * - Size: <1GB (not validated here, assumed to be enforced at upload time)
 * - Duration: 3-90 seconds (not validated here, assumed to be enforced at upload time)
 * - Resolution: ≥540px (not validated here, assumed to be enforced at upload time)
 * - Caption: ≤2200 characters
 *
 * @param post - The Post record
 * @returns Validation result with error message if invalid
 */
function validateVideoRequirements(post: Post): { valid: boolean; error?: string } {
  // Validate video format is MP4 or MOV
  const videoFileKey = post.videoFileKey.toLowerCase();
  if (!videoFileKey.endsWith(".mp4") && !videoFileKey.endsWith(".mov")) {
    return {
      valid: false,
      error: "Video format must be MP4 or MOV",
    };
  }

  // Validate caption length does not exceed 2,200 characters
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title;
  if (caption.length > 2200) {
    return {
      valid: false,
      error: `Caption exceeds 2,200 character limit (current: ${caption.length})`,
    };
  }

  // Note: File size, duration, and resolution validation are handled by Instagram API
  // They are enforced by Instagram during container creation

  return { valid: true };
}

/**
 * Handle Instagram API upload errors with appropriate retry logic
 *
 * This function implements the error handling strategy for Instagram API errors:
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
  uploadResult: CreateContainerResponse,
): Promise<UploadResult> {
  const prisma = getPrisma();
  const errorCode = uploadResult.errorCode || "unknown_error";
  const errorMessage = uploadResult.error || "Instagram API error";

  // HTTP 400 - Mark as FAILED with error message (no retry)
  if (errorCode === "bad_request") {
    // Log all errors with full context
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

  // HTTP 401/403 - Attempt token refresh and retry once
  if (errorCode === "auth_error") {
    // Log token refresh attempts
    console.warn(
      "[handleUploadError] Authentication error (HTTP 401/403), attempting token refresh:",
      {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      },
    );

    const refreshResult = await refreshInstagramToken(socialAccount);

    if (!refreshResult.success) {
      // Log token refresh results
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

      // Create notification for failed upload
      await createFailedUploadNotificationById(
        post.id,
        "Token refresh failed after authentication error"
      );

      return {
        success: false,
        error: "Token refresh failed after authentication error",
      };
    }

    // Retry upload once with refreshed token
    // Log token refresh results
    console.log("[handleUploadError] Retrying upload with refreshed token:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      timestamp: new Date().toISOString(),
    });

    // Recursively call uploadToInstagram with updated account
    // Note: This will only retry once because the token is now fresh
    return await uploadToInstagram(post, platformPost, refreshResult.updatedAccount!);
  }

  // HTTP 429 - Log error and skip until next cron run
  if (errorCode === "rate_limit") {
    console.warn("[handleUploadError] Instagram API rate limit exceeded (HTTP 429):", {
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
      error: "Instagram API rate limit exceeded",
    };
  }

  // HTTP 5xx or timeout - Increment retryCount
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    const currentRetryCount = platformPost.retryCount;
    const newRetryCount = currentRetryCount + 1;

    // Log all errors with full context
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

    // If retryCount > 3, mark as FAILED
    if (newRetryCount > 3) {
      // Log all errors with full context
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

      // Create notification for failed upload
      await createFailedUploadNotificationById(
        post.id,
        `${errorMessage} (max retries exceeded)`
      );

      return {
        success: false,
        error: `${errorMessage} (max retries exceeded)`,
      };
    }

    // Leave status as PENDING for retry on next cron run
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
  // Log all errors with full context
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
 * Refresh an Instagram access token
 *
 * This function refreshes an expired or expiring Instagram long-lived token.
 * Instagram tokens must be at least 24 hours old to be refreshed.
 *
 * @param socialAccount - The SocialAccount record with the token to refresh
 * @returns TokenRefreshResult indicating success or failure
 */
async function refreshInstagramToken(
  socialAccount: SocialAccount,
): Promise<{ success: boolean; error?: string; updatedAccount?: SocialAccount }> {
  const prisma = getPrisma();

  try {
    // Decrypt the current access token
    let currentAccessToken: string;
    try {
      currentAccessToken = decryptToken(socialAccount.accessToken);
    } catch (error) {
      console.error("[refreshInstagramToken] Failed to decrypt access token:", {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: "Failed to decrypt access token",
      };
    }

    // Refresh token via GET to Instagram API
    const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
    refreshUrl.searchParams.append("grant_type", "ig_refresh_token");
    refreshUrl.searchParams.append("access_token", currentAccessToken);

    // Set 10-second timeout for refresh request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(refreshUrl.toString(), {
        method: "GET",
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);

      // Check if error is due to timeout/abort
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[refreshInstagramToken] Request timeout:", {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          error: "Request timeout. Please try again.",
        };
      }

      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error?.message || `HTTP ${response.status} error during token refresh`;

      console.error("[refreshInstagramToken] Token refresh failed:", {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        status: response.status,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      // If token refresh fails, mark PlatformPost as FAILED
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();

    // Extract new access token and expiration
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in; // Seconds until expiration (60 days = 5184000 seconds)

    if (!newAccessToken || !expiresIn) {
      console.error("[refreshInstagramToken] Invalid response from Instagram:", {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        hasAccessToken: !!newAccessToken,
        hasExpiresIn: !!expiresIn,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: "Invalid response from Instagram API",
      };
    }

    // Encrypt new access token
    const encryptedAccessToken = encryptToken(newAccessToken);

    // Calculate new expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Update the database with new token and expiration
    const updatedAccount = await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: encryptedAccessToken,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    console.log("[refreshInstagramToken] Token refreshed successfully:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      expiresAt,
      timestamp: new Date().toISOString(),
    });

    // If token refresh succeeds, use new token for upload attempt
    return {
      success: true,
      updatedAccount,
    };
  } catch (error) {
    console.error("[refreshInstagramToken] Unexpected error:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload a single post to Instagram
 *
 * This function handles the complete upload flow for a single post:
 * 1. Retrieve and decrypt access token
 * 2. Check if token is expired and refresh if needed
 * 3. Check upload rate limit
 * 4. Generate signed Backblaze URL
 * 5. Validate video requirements
 * 6. Format caption
 * 7. Call Instagram API to create media container
 * 8. Update database with container ID and status
 * 9. Increment rate limit counter
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record with encrypted tokens
 * @returns UploadResult indicating success or failure
 */
async function uploadToInstagram(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
): Promise<UploadResult> {
  // Step 1: Check if access token is expired and refresh if needed
  let currentSocialAccount = socialAccount;

  // Check if access token is expired (expiresAt < now + 24 hours)
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (socialAccount.expiresAt && new Date(socialAccount.expiresAt) < twentyFourHoursFromNow) {
    // Log token refresh attempts
    console.log("[uploadToInstagram] Token expired or expiring soon, refreshing:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      expiresAt: socialAccount.expiresAt,
      timestamp: new Date().toISOString(),
    });

    const refreshResult = await refreshInstagramToken(socialAccount);

    if (!refreshResult.success) {
      // Token refresh failed - mark as FAILED
      await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, "Token refresh failed");

      // Create notification for failed upload
      await createFailedUploadNotificationById(post.id, "Token refresh failed");

      return {
        success: false,
        error: "Token refresh failed",
      };
    }

    // Use the updated account with new tokens
    currentSocialAccount = refreshResult.updatedAccount!;

    // Log token refresh results
    console.log("[uploadToInstagram] Token refreshed successfully:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  // NEVER log plaintext access tokens
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    // Log all errors with full context
    console.error("[uploadToInstagram] Failed to decrypt access token:", {
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
  const rateLimitResult = await checkUploadRateLimit(post.userId);

  if (!rateLimitResult.allowed) {
    // If rate limit exceeded, skip post and log warning
    console.warn("[uploadToInstagram] Upload rate limit exceeded:", {
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

    console.log("[uploadToInstagram] Generated signed URL:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      expiresAt: urlResult.expiresAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // If signed URL generation fails, mark PlatformPost as FAILED
    console.error("[uploadToInstagram] Failed to generate signed URL:", {
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

  // Step 5: Validate video requirements
  const validation = validateVideoRequirements(post);
  if (!validation.valid) {
    // If validation fails, mark PlatformPost as FAILED with descriptive error message
    console.error("[uploadToInstagram] Video validation failed:", {
      userId: post.userId,
      postId: post.id,
      error: validation.error,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, validation.error);

    return {
      success: false,
      error: validation.error,
    };
  }

  // Step 6: Format caption
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title;

  // Step 7: Call Instagram API to create media container
  // Log each Instagram API request with userId, postId, endpoint
  console.log("[uploadToInstagram] Calling Instagram API:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    igUserId: currentSocialAccount.platformAccountId,
    endpoint: `/v21.0/${currentSocialAccount.platformAccountId}/media`,
    timestamp: new Date().toISOString(),
  });

  const uploadResult = await createMediaContainer({
    accessToken,
    igUserId: currentSocialAccount.platformAccountId,
    videoUrl: signedUrl,
    caption,
    shareToFeed: true,
  });

  // Log each Instagram API response with status code and container ID
  console.log("[uploadToInstagram] Instagram API response:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    success: uploadResult.success,
    containerId: uploadResult.containerId,
    errorCode: uploadResult.errorCode,
    timestamp: new Date().toISOString(),
  });

  if (!uploadResult.success) {
    // Handle Instagram API errors with appropriate retry logic
    return await handleUploadError(post, platformPost, socialAccount, uploadResult);
  }

  // Step 8: Update database with container ID and status
  await updatePlatformPostStatus(platformPost.id, "PUBLISHING", uploadResult.containerId);

  // Step 9: Increment upload rate limit counter
  await incrementUploadCounter(post.userId);

  return {
    success: true,
    containerId: uploadResult.containerId,
  };
}

/**
 * Create a notification for a failed upload
 *
 * This helper function creates a notification when an upload fails.
 * It wraps the notification creation in a try-catch to ensure that
 * notification failures don't break the upload processing flow.
 *
 * @param platformPost - The PlatformPost record with Post data
 * @param errorMessage - The error message describing the failure
 */
async function createFailedUploadNotification(
  platformPost: PlatformPost & { Post: Post },
  errorMessage: string
): Promise<void> {
  try {
    const notificationContent = formatUploadFailed(
      platformPost.Post.title,
      "Instagram",
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
 * Create a notification for a failed upload by querying the Post
 *
 * This helper function queries the Post to get the title and userId,
 * then creates a notification when an upload fails.
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
      select: { title: true, userId: true },
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
      "Instagram",
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

/**
 * Update the status of a PlatformPost record
 *
 * This function updates a PlatformPost record with new status, publishId (container ID),
 * and error message. It uses a database transaction to ensure atomic updates.
 *
 * @param platformPostId - The ID of the PlatformPost to update
 * @param status - The new status to set
 * @param publishId - Optional Instagram container ID
 * @param errorMessage - Optional error message for FAILED status
 * @returns Promise<void>
 */
async function updatePlatformPostStatus(
  platformPostId: string,
  status: PlatformPostStatus,
  publishId?: string,
  errorMessage?: string,
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
      } = {
        status,
        updatedAt: new Date(),
      };

      // Add publishId (container ID) if provided
      if (publishId !== undefined) {
        updateData.publishId = publishId;
      }

      // Add errorMessage if provided (or clear it if null)
      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      } else if (status === "PUBLISHED") {
        // Clear error message on successful publish
        updateData.errorMessage = null;
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
 * Sync the Post status based on all PlatformPost statuses
 *
 * This function calculates the overall Post status based on the statuses of all
 * associated PlatformPost records:
 * - All PUBLISHED → PUBLISHED
 * - All FAILED → FAILED
 * - Any PUBLISHING → PUBLISHING
 * - Mix of PUBLISHED and FAILED → PARTIALLY_PUBLISHED
 *
 * @param postId - The ID of the Post to sync
 * @returns Promise<void>
 */
async function syncPostStatus(postId: string): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic update
    await prisma.$transaction(async (tx) => {
      // Get all PlatformPost records for this Post
      const platformPosts = await tx.platformPost.findMany({
        where: { postId },
        select: { status: true },
      });

      if (platformPosts.length === 0) {
        console.warn("[syncPostStatus] No platform posts found:", {
          postId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Count statuses
      const statusCounts = {
        PENDING: 0,
        PUBLISHING: 0,
        PUBLISHED: 0,
        FAILED: 0,
      };

      for (const pp of platformPosts) {
        statusCounts[pp.status]++;
      }

      // Determine overall Post status
      let newPostStatus: PostStatus;

      // Any PUBLISHING → PUBLISHING
      if (statusCounts.PUBLISHING > 0) {
        newPostStatus = "PUBLISHING";
      }
      // All PUBLISHED → PUBLISHED
      else if (statusCounts.PUBLISHED === platformPosts.length) {
        newPostStatus = "PUBLISHED";
      }
      // All FAILED → FAILED
      else if (statusCounts.FAILED === platformPosts.length) {
        newPostStatus = "FAILED";
      }
      // Mix of PUBLISHED and FAILED → PARTIALLY_PUBLISHED
      else if (statusCounts.PUBLISHED > 0 && statusCounts.FAILED > 0) {
        newPostStatus = "PARTIALLY_PUBLISHED";
      }
      // Default: keep as SCHEDULED if still pending
      else {
        newPostStatus = "SCHEDULED";
      }

      // Update Post.updatedAt timestamp when status changes
      await tx.post.update({
        where: { id: postId },
        data: {
          status: newPostStatus,
          updatedAt: new Date(),
        },
      });

      console.log("[syncPostStatus] Post status synced:", {
        postId,
        newStatus: newPostStatus,
        statusCounts,
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
