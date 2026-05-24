/**
 * Scheduled YouTube Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * YouTube uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Delegating upload jobs to Render.com worker
 * - Updating database records based on worker response
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount, PlatformPostStatus, PostStatus } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { isTokenExpired, refreshToken } from "@/lib/tokenManager";
import { checkUploadRateLimit } from "@/lib/youtube/rateLimiter";
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
 * Result of uploading a single post
 */
interface UploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
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
    console.error("[process-scheduled-youtube-uploads] No Authorization header");
    return false;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[process-scheduled-youtube-uploads] CRON_SECRET not configured");
    return false;
  }

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
 * POST /api/cron/process-scheduled-youtube-uploads
 *
 * Main handler for processing scheduled YouTube uploads. This endpoint:
 * 1. Verifies the CRON_SECRET for authentication
 * 2. Queries for scheduled posts within the scheduling window
 * 3. Delegates upload jobs to Render.com worker
 * 4. Returns a summary of operations
 *
 * @param {NextRequest} request - The incoming request from cron-job.org
 * @returns {Promise<NextResponse>} Response with processing summary or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-youtube-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  //  Log cron execution start with timestamp
  console.log("[process-scheduled-youtube-uploads] Cron execution started:", {
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
              platform: "YouTube",
              isActive: true,
            },
          },
          include: {
            SocialAccount: true,
          },
        },
      },
    });

    // Filter to only include posts with YouTube PlatformPost records
    // 
    const postsToProcess = scheduledPosts.filter((post) => post.PlatformPost.length > 0);

    //  Log count of posts found in scheduling window
    console.log("[process-scheduled-youtube-uploads] Found posts to process:", {
      timestamp: new Date().toISOString(),
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      totalScheduled: scheduledPosts.length,
      withYouTube: postsToProcess.length,
    });

    // Initialize result summary
    const result: ProcessResult = {
      processed: postsToProcess.length,
      uploaded: 0,
      errors: [],
    };

    // Process scheduled posts for upload
    // Delegate to Render.com worker
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Sync Post status for all processed posts
    const postIds = new Set<string>();
    for (const post of postsToProcess) {
      postIds.add(post.id);
    }

    // Sync status for all affected posts
    for (const postId of postIds) {
      try {
        await syncPostStatus(postId);
      } catch (error) {
        console.error("[process-scheduled-youtube-uploads] Failed to sync post status:", {
          postId,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    //  Log cron execution end with timestamp
    console.log("[process-scheduled-youtube-uploads] Cron execution completed:", {
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
    console.error("[process-scheduled-youtube-uploads] Database error:", {
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
 * Process scheduled posts for upload to YouTube via Render.com worker
 *
 * This function processes each scheduled post by:
 * 1. Retrieving and decrypting the SocialAccount tokens
 * 2. Checking if the access token is expired and refreshing if needed
 * 3. Checking upload rate limits
 * 4. Delegating upload job to Render.com worker
 * 5. Updating the database with the result
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
        const result = await uploadToYouTube(post, platformPost, platformPost.SocialAccount);

        if (result.success) {
          uploaded++;
          //  Log worker response with video ID
          console.log("[processScheduledPosts] Upload successful:", {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            videoId: result.videoId,
            videoUrl: result.videoUrl,
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
 * Upload a single post to YouTube via Render.com worker
 *
 * This function handles the complete upload flow for a single post:
 * 1. Retrieve and decrypt access token
 * 2. Check if token is expired and refresh if needed
 * 3. Check upload rate limit
 * 4. Delegate upload job to Render.com worker
 * 5. Update database with result
 * 6. Increment rate limit counter
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record with encrypted tokens
 * @returns UploadResult indicating success or failure
 */
async function uploadToYouTube(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
): Promise<UploadResult> {
  // Step 1: Check if access token is expired and refresh if needed
  let currentSocialAccount = socialAccount;

  if (isTokenExpired(socialAccount)) {
    console.log("[uploadToYouTube] Token expired, refreshing:", {
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
      console.error("[uploadToYouTube] Token refresh failed:", {
        userId: post.userId,
        postId: post.id,
        platform: socialAccount.platform,
        error: refreshResult.error,
        timestamp: new Date().toISOString(),
        hint: refreshResult.error?.includes("invalid or expired")
          ? "User needs to reconnect their YouTube account"
          : "Check OAuth credentials and network connectivity",
      });

      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        refreshResult.error || "Token refresh failed",
      );

      return {
        success: false,
        error: refreshResult.error || "Token refresh failed",
      };
    }

    // Use the updated account with new tokens
    currentSocialAccount = refreshResult.updatedAccount!;

    console.log("[uploadToYouTube] Token refreshed successfully:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token and refresh token
  // 
  //  NEVER log plaintext access tokens
  let accessToken: string;
  let refreshTokenDecrypted: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);

    // Check if refreshToken exists before decrypting
    if (!currentSocialAccount.refreshToken) {
      throw new Error("Refresh token is missing");
    }

    refreshTokenDecrypted = decryptToken(currentSocialAccount.refreshToken);
  } catch (error) {
    //  Log all errors with full context
    console.error("[uploadToYouTube] Failed to decrypt tokens:", {
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
    console.warn("[uploadToYouTube] Upload rate limit exceeded:", {
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

  // Step 4: Delegate upload job to Render.com worker
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    console.error("[uploadToYouTube] Worker configuration missing:", {
      hasWorkerUrl: !!workerUrl,
      hasWorkerSecret: !!workerSecret,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      "Worker configuration missing",
    );

    return {
      success: false,
      error: "Worker configuration missing",
    };
  }

  //  Log worker request with userId, postId, endpoint
  console.log("[uploadToYouTube] Calling Render.com worker:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    endpoint: `${workerUrl}/upload`,
    timestamp: new Date().toISOString(),
  });

  try {
    //  Send HTTP POST to worker with authentication
    const response = await fetch(`${workerUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        postId: post.id,
        platformPostId: platformPost.id,
        videoFileKey: post.videoFileKey,
        videoFileName: post.videoFileName,
        videoFileSize: post.videoFileSize,
        title: post.title,
        description: post.description,
        accessToken,
        refreshToken: refreshTokenDecrypted,
        expiresAt: currentSocialAccount.expiresAt?.toISOString() || new Date().toISOString(),
        userId: post.userId,
      }),
      //  Set 20-minute timeout (increased to handle large videos with chunked upload)
      signal: AbortSignal.timeout(20 * 60 * 1000),
    });

    // Parse response with error handling for incomplete JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      console.error("[uploadToYouTube] Failed to parse worker response:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        status: response.status,
        error: jsonError instanceof Error ? jsonError.message : "Unknown error",
        hint: "Worker may have crashed or timed out during upload",
        timestamp: new Date().toISOString(),
      });

      // Treat as retryable error
      const currentRetryCount = platformPost.retryCount;
      const newRetryCount = currentRetryCount + 1;

      const prisma = getPrisma();
      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          retryCount: newRetryCount,
          updatedAt: new Date(),
        },
      });

      if (newRetryCount > 3) {
        await updatePlatformPostStatus(
          platformPost.id,
          "FAILED",
          undefined,
          "Worker response parsing failed (max retries exceeded)",
        );

        return {
          success: false,
          error: "Worker response parsing failed (max retries exceeded)",
        };
      }

      return {
        success: false,
        shouldSkip: true,
        error: `Worker response parsing failed (will retry, attempt ${newRetryCount}/3)`,
      };
    }

    //  Log worker response
    console.log("[uploadToYouTube] Worker response:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      status: response.status,
      success: responseData.success,
      videoId: responseData.videoId,
      timestamp: new Date().toISOString(),
    });

    if (response.ok && responseData.success) {
      //  Update status to PUBLISHED on success
      await updatePlatformPostStatus(
        platformPost.id,
        "PUBLISHED",
        responseData.videoId,
        undefined,
        responseData.videoUrl,
      );

      // Increment rate limit counter
      //  incrementUploadCounter(post.userId);

      return {
        success: true,
        videoId: responseData.videoId,
        videoUrl: responseData.videoUrl,
      };
    } else {
      //  Update status to FAILED on error
      const errorMessage = responseData.error || "Worker upload failed";

      // Check if this is a retryable error
      if (response.status >= 500 || responseData.errorCode === "timeout") {
        // Retryable error - increment retry count
        const currentRetryCount = platformPost.retryCount;
        const newRetryCount = currentRetryCount + 1;

        const prisma = getPrisma();
        await prisma.platformPost.update({
          where: { id: platformPost.id },
          data: {
            retryCount: newRetryCount,
            updatedAt: new Date(),
          },
        });

        //  If retryCount > 3, mark as FAILED
        if (newRetryCount > 3) {
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

        //  Leave status as PENDING for retry
        console.log("[uploadToYouTube] Will retry on next cron run:", {
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
      } else {
        // Non-retryable error - mark as FAILED immediately
        //  updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  } catch (error) {
    //  Handle timeout errors
    if (error instanceof Error && error.name === "TimeoutError") {
      // Increment retry count
      const currentRetryCount = platformPost.retryCount;
      const newRetryCount = currentRetryCount + 1;

      const prisma = getPrisma();
      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          retryCount: newRetryCount,
          updatedAt: new Date(),
        },
      });

      if (newRetryCount > 3) {
        await updatePlatformPostStatus(
          platformPost.id,
          "FAILED",
          undefined,
          "Worker request timeout (max retries exceeded)",
        );

        return {
          success: false,
          error: "Worker request timeout (max retries exceeded)",
        };
      }

      console.log("[uploadToYouTube] Worker timeout, will retry:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        retryCount: newRetryCount,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        shouldSkip: true,
        error: `Worker request timeout (will retry, attempt ${newRetryCount}/3)`,
      };
    }

    // Other network errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[uploadToYouTube] Worker request failed:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(
      platformPost.id,
      "FAILED",
      undefined,
      `Worker request failed: ${errorMessage}`,
    );

    return {
      success: false,
      error: `Worker request failed: ${errorMessage}`,
    };
  }
}

/**
 * Update the status of a PlatformPost record
 *
 * This function updates a PlatformPost record with new status, videoId,
 * platformUrl, and error message. It uses a database transaction to ensure atomic updates.
 * After updating the status, it creates appropriate notifications for PUBLISHED or FAILED statuses.
 *
 * @param platformPostId - The ID of the PlatformPost to update
 * @param status - The new status to set
 * @param videoId - Optional YouTube video ID
 * @param errorMessage - Optional error message for FAILED status
 * @param videoUrl - Optional YouTube video URL
 * @returns Promise<void>
 */
async function updatePlatformPostStatus(
  platformPostId: string,
  status: PlatformPostStatus,
  videoId?: string,
  errorMessage?: string,
  videoUrl?: string,
): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic update
    // , 14.2
    await prisma.$transaction(async (tx) => {
      const updateData: {
        status: PlatformPostStatus;
        updatedAt: Date;
        errorMessage?: string | null;
        publishedAt?: Date;
        platformPostId?: string;
        platformUrl?: string;
      } = {
        status,
        updatedAt: new Date(),
      };

      // Add platformPostId (YouTube video ID) if provided
      if (videoId !== undefined) {
        updateData.platformPostId = videoId;
      }

      // Add platformUrl if provided
      if (videoUrl !== undefined) {
        updateData.platformUrl = videoUrl;
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
      videoId,
      videoUrl,
      hasError: !!errorMessage,
      timestamp: new Date().toISOString(),
    });

    // Create notification after updating status
    // Requirement 18.1, 18.2: Create notifications for PUBLISHED and FAILED statuses
    if (status === "PUBLISHED") {
      await createSuccessUploadNotificationById(platformPostId);
    } else if (status === "FAILED") {
      await createFailedUploadNotificationById(platformPostId, errorMessage || "Upload failed");
    }
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
      // .1, 10.2, 10.3, 10.4
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
 * Create a success notification for a YouTube upload
 *
 * This function queries the PlatformPost and related Post to retrieve the post title,
 * then creates a notification using the formatUploadSuccess helper.
 * Errors are logged but do not propagate to avoid failing the upload processing.
 *
 * Requirement 18.1, 18.3: Create UPLOAD_SUCCESS notification with post title and platform
 * Requirement 18.4: Wrap in try-catch to log errors without failing upload processing
 *
 * @param platformPostId - The ID of the PlatformPost that was successfully uploaded
 * @returns Promise<void>
 */
async function createSuccessUploadNotificationById(
  platformPostId: string
): Promise<void> {
  try {
    const prisma = getPrisma();

    // Query PlatformPost with related Post to get post title and userId
    const platformPost = await prisma.platformPost.findUnique({
      where: { id: platformPostId },
      include: {
        Post: true,
      },
    });

    if (!platformPost) {
      console.error("[createSuccessUploadNotificationById] PlatformPost not found:", {
        platformPostId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Format notification content using helper
    const notificationContent = formatUploadSuccess(
      platformPost.Post.title,
      "YouTube"
    );

    // Create notification
    await createNotification(
      platformPost.Post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_SUCCESS"
    );

    console.log("[createSuccessUploadNotificationById] Success notification created:", {
      platformPostId,
      postId: platformPost.postId,
      userId: platformPost.Post.userId,
      timestamp: new Date().toISOString(),
    });
  } catch (notificationError) {
    // Log error but do not throw to avoid failing upload processing
    console.error("[createSuccessUploadNotificationById] Failed to create success notification:", {
      platformPostId,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a failure notification for a YouTube upload
 *
 * This function queries the PlatformPost and related Post to retrieve the post title,
 * then creates a notification using the formatUploadFailed helper.
 * Errors are logged but do not propagate to avoid failing the upload processing.
 *
 * Requirement 18.2, 18.3: Create UPLOAD_FAILED notification with post title, platform, and error
 * Requirement 18.4: Wrap in try-catch to log errors without failing upload processing
 *
 * @param platformPostId - The ID of the PlatformPost that failed to upload
 * @param errorMessage - The error message describing the failure
 * @returns Promise<void>
 */
async function createFailedUploadNotificationById(
  platformPostId: string,
  errorMessage: string
): Promise<void> {
  try {
    const prisma = getPrisma();

    // Query PlatformPost with related Post to get post title and userId
    const platformPost = await prisma.platformPost.findUnique({
      where: { id: platformPostId },
      include: {
        Post: true,
      },
    });

    if (!platformPost) {
      console.error("[createFailedUploadNotificationById] PlatformPost not found:", {
        platformPostId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Format notification content using helper
    const notificationContent = formatUploadFailed(
      platformPost.Post.title,
      "YouTube",
      errorMessage
    );

    // Create notification
    await createNotification(
      platformPost.Post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_FAILED"
    );

    console.log("[createFailedUploadNotificationById] Failure notification created:", {
      platformPostId,
      postId: platformPost.postId,
      userId: platformPost.Post.userId,
      timestamp: new Date().toISOString(),
    });
  } catch (notificationError) {
    // Log error but do not throw to avoid failing upload processing
    console.error("[createFailedUploadNotificationById] Failed to create failure notification:", {
      platformPostId,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
