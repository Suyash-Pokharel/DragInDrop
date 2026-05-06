/**
 * Scheduled YouTube Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * YouTube uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Delegating upload jobs to Render.com worker
 * - Updating database records based on worker response
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount, PlatformPostStatus, PostStatus } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { isTokenExpired, refreshToken } from "@/lib/tokenManager";
import { checkUploadRateLimit, incrementUploadCounter } from "@/lib/youtube/rateLimiter";

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
 * POST /api/cron/process-scheduled-youtube-uploads
 *
 * Main handler for processing scheduled YouTube uploads. This endpoint:
 * 1. Verifies the CRON_SECRET for authentication
 * 2. Queries for scheduled posts within the scheduling window
 * 3. Delegates upload jobs to Render.com worker
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
    console.error("[process-scheduled-youtube-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Requirement 12.1: Log cron execution start with timestamp
  console.log("[process-scheduled-youtube-uploads] Cron execution started:", {
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
    // Requirement: 3.5
    const postsToProcess = scheduledPosts.filter((post) => post.PlatformPost.length > 0);

    // Requirement 12.2: Log count of posts found in scheduling window
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
    // Requirement: 9.1-9.9 - Delegate to Render.com worker
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Sync Post status for all processed posts
    // Requirement: 10.1, 10.2, 10.3, 10.4, 10.5
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

    // Requirement 12.1: Log cron execution end with timestamp
    console.log("[process-scheduled-youtube-uploads] Cron execution completed:", {
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
    // Requirement 12.5: Log all errors with full context
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
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5,
 *               9.6, 9.7, 9.8, 9.9, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
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
        const result = await uploadToYouTube(post, platformPost, platformPost.SocialAccount);

        if (result.success) {
          uploaded++;
          // Requirement 12.4: Log worker response with video ID
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
          // Requirement 12.5: Log all errors with full context
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
        // Requirement 12.5: Log all errors with full context (userId, postId, error message, stack trace)
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
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5,
 *               9.6, 9.7, 9.8, 9.9, 11.1, 11.2, 11.3
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
  // Requirements: 5.3, 5.4, 5.5, 5.6, 5.7
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
      // Requirement: 5.7
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
  // Requirement: 5.2
  // Requirement 12.6: NEVER log plaintext access tokens
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
    // Requirement 12.5: Log all errors with full context
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
  // Requirements: 11.1, 11.2, 11.3
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
  // Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
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

  // Requirement 12.3: Log worker request with userId, postId, endpoint
  console.log("[uploadToYouTube] Calling Render.com worker:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    endpoint: `${workerUrl}/upload`,
    timestamp: new Date().toISOString(),
  });

  try {
    // Requirement 9.1, 9.2, 9.3: Send HTTP POST to worker with authentication
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
      // Requirement 9.4: Set 20-minute timeout (increased to handle large videos with chunked upload)
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

    // Requirement 12.4: Log worker response
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
      // Requirement 9.5: Update status to PUBLISHED on success
      await updatePlatformPostStatus(
        platformPost.id,
        "PUBLISHED",
        responseData.videoId,
        undefined,
        responseData.videoUrl,
      );

      // Increment rate limit counter
      // Requirement 11.3
      await incrementUploadCounter(post.userId);

      return {
        success: true,
        videoId: responseData.videoId,
        videoUrl: responseData.videoUrl,
      };
    } else {
      // Requirement 9.6: Update status to FAILED on error
      const errorMessage = responseData.error || "Worker upload failed";

      // Check if this is a retryable error
      // Requirement 15.1, 15.2, 15.3
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

        // Requirement 15.3: If retryCount > 3, mark as FAILED
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

        // Requirement 15.2: Leave status as PENDING for retry
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
        // Requirement 15.5
        await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  } catch (error) {
    // Requirement 9.7: Handle timeout errors
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
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.2, 14.3, 14.4
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
    // Requirement: 14.1, 14.2
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
