/**
 * Scheduled Facebook Pages Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * Facebook Pages uploads. It handles:
 * - Querying scheduled posts within the scheduling window
 * - Uploading videos to Facebook Pages
 * - Publishing videos immediately (no container polling needed)
 * - Updating database records
 *
 * NOTE: This endpoint is simpler than Instagram/Threads because Facebook videos
 * publish immediately (no container polling needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { buildSignedVideoUrl } from "@/lib/backblaze/urlBuilder";
import {
  validateVideoForFacebook,
  formatCaptionForFacebook,
  getVideoFileType,
} from "@/lib/facebook/validation";
import {
  initializeUploadSession,
  uploadVideoFile,
  publishVideo,
  refreshFacebookToken,
} from "@/lib/facebook/api";
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
 * Error types for classification
 */
enum ErrorType {
  CLIENT_ERROR = "client_error", // HTTP 400 - Do NOT retry
  AUTH_ERROR = "auth_error", // HTTP 401/403 - Refresh token and retry once
  RATE_LIMIT = "rate_limit", // HTTP 429 - Skip until next cron run
  SERVER_ERROR = "server_error", // HTTP 5xx - Increment retry count
  TIMEOUT = "timeout", // Network timeout - Increment retry count
  NETWORK_ERROR = "network_error", // Network error - Increment retry count
  UNKNOWN_ERROR = "unknown_error", // Unknown error - Increment retry count
}

/**
 * Classify error based on error code from Facebook API
 *
 * This function maps error codes from the Facebook API client to error types
 * that determine the retry strategy.
 *
 * @param {string | undefined} errorCode - Error code from Facebook API response
 * @returns {ErrorType} The classified error type
 *
 * @example
 * const errorType = classifyError('bad_request');
 * // Returns ErrorType.CLIENT_ERROR
 */
function classifyError(errorCode: string | undefined): ErrorType {
  if (!errorCode) {
    return ErrorType.UNKNOWN_ERROR;
  }

  switch (errorCode) {
    case "bad_request":
      return ErrorType.CLIENT_ERROR;

    case "auth_error":
      return ErrorType.AUTH_ERROR;

    case "rate_limit":
      return ErrorType.RATE_LIMIT;

    case "server_error":
      return ErrorType.SERVER_ERROR;

    case "timeout":
      return ErrorType.TIMEOUT;

    case "network_error":
      return ErrorType.NETWORK_ERROR;

    default:
      return ErrorType.UNKNOWN_ERROR;
  }
}

/**
 * Handle upload error with appropriate retry logic
 *
 * This function implements the error handling and retry logic based on error type:
 * - CLIENT_ERROR (HTTP 400): Mark as FAILED, do NOT retry
 * - AUTH_ERROR (HTTP 401/403): Attempt token refresh and retry once
 * - RATE_LIMIT (HTTP 429): Log and skip until next cron run
 * - SERVER_ERROR (HTTP 5xx): Increment retry count
 * - TIMEOUT/NETWORK_ERROR: Increment retry count
 * - Mark as FAILED when retryCount exceeds 3
 * - Leave as PENDING when retryCount is 3 or less
 *
 * @param {ErrorType} errorType - The classified error type
 * @param {string} errorMessage - The error message
 * @param {string} errorCode - The error code from API
 * @param {PlatformPost} platformPost - The platform post record
 * @param {SocialAccount} socialAccount - The social account with access token
 * @param {Post} post - The post being uploaded
 * @returns {Promise<void>}
 */
async function handleUploadError(
  errorType: ErrorType,
  errorMessage: string,
  errorCode: string | undefined,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
  post: Post,
): Promise<void> {
  const prisma = getPrisma();

  switch (errorType) {
    case ErrorType.CLIENT_ERROR:
      // Mark as FAILED for HTTP 400 errors (do NOT retry)
      console.error(
        "[process-scheduled-facebook-pages-uploads] Client error - marking as FAILED:",
        {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: errorMessage,
          errorCode,
          timestamp: new Date().toISOString(),
        },
      );

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage: `Client error: ${errorMessage}`,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, `Client error: ${errorMessage}`);
      break;

    case ErrorType.AUTH_ERROR:
      // Attempt token refresh and retry once for HTTP 401/403 errors
      console.warn(
        "[process-scheduled-facebook-pages-uploads] Auth error - attempting token refresh:",
        {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: errorMessage,
          errorCode,
          timestamp: new Date().toISOString(),
        },
      );

      try {
        const decryptedToken = decryptToken(socialAccount.accessToken);
        const refreshResult = await refreshFacebookToken({ accessToken: decryptedToken });

        if (!refreshResult.success) {
          // Mark as FAILED if token refresh fails after auth error
          console.error(
            "[process-scheduled-facebook-pages-uploads] Token refresh failed - marking as FAILED:",
            {
              userId: post.userId,
              postId: post.id,
              platformPostId: platformPost.id,
              refreshError: refreshResult.error,
              timestamp: new Date().toISOString(),
            },
          );

          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "FAILED",
              errorMessage: `Auth error - token refresh failed: ${refreshResult.error}`,
              updatedAt: new Date(),
            },
          });

          // Create notification for failed upload
          await createFailedUploadNotification(post, platformPost, `Auth error - token refresh failed: ${refreshResult.error}`);
        } else {
          // Token refresh succeeded - leave as PENDING for retry on next cron run
          console.log(
            "[process-scheduled-facebook-pages-uploads] Token refreshed - will retry on next cron run:",
            {
              userId: post.userId,
              postId: post.id,
              platformPostId: platformPost.id,
              expiresIn: refreshResult.expiresIn,
              timestamp: new Date().toISOString(),
            },
          );

          // Note: In a production system, we would encrypt and update the new token in the database
          // For now, we just leave the post as PENDING to retry on next cron run
        }
      } catch (error) {
        // Token decryption or refresh failed
        console.error("[process-scheduled-facebook-pages-uploads] Token refresh attempt failed:", {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });

        await prisma.platformPost.update({
          where: { id: platformPost.id },
          data: {
            status: "FAILED",
            errorMessage: `Auth error - token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            updatedAt: new Date(),
          },
        });

        // Create notification for failed upload
        await createFailedUploadNotification(post, platformPost, `Auth error - token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      break;

    case ErrorType.RATE_LIMIT:
      // Log error and skip post until next cron run for HTTP 429 errors
      console.warn(
        "[process-scheduled-facebook-pages-uploads] Rate limit exceeded - skipping until next cron run:",
        {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: errorMessage,
          errorCode,
          timestamp: new Date().toISOString(),
        },
      );
      // Leave status as PENDING - will retry on next cron run
      break;

    case ErrorType.SERVER_ERROR:
    case ErrorType.TIMEOUT:
    case ErrorType.NETWORK_ERROR:
    case ErrorType.UNKNOWN_ERROR:
      // Increment retryCount for HTTP 5xx errors and network timeout errors
      const newRetryCount = platformPost.retryCount + 1;

      // Log retry attempts with current retry count
      console.warn(
        "[process-scheduled-facebook-pages-uploads] Retryable error - incrementing retry count:",
        {
          userId: post.userId,
          postId: post.id,
          platformPostId: platformPost.id,
          error: errorMessage,
          errorCode,
          errorType,
          currentRetryCount: platformPost.retryCount,
          newRetryCount,
          timestamp: new Date().toISOString(),
        },
      );

      if (newRetryCount > 3) {
        // Mark as FAILED when retryCount exceeds 3
        console.error(
          "[process-scheduled-facebook-pages-uploads] Max retries exceeded - marking as FAILED:",
          {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            retryCount: newRetryCount,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
        );

        await prisma.platformPost.update({
          where: { id: platformPost.id },
          data: {
            status: "FAILED",
            errorMessage: `Failed after ${newRetryCount} retries: ${errorMessage}`,
            retryCount: newRetryCount,
            updatedAt: new Date(),
          },
        });

        // Create notification for failed upload
        await createFailedUploadNotification(post, platformPost, `Failed after ${newRetryCount} retries: ${errorMessage}`);
      } else {
        //  Leave status as PENDING when retryCount is 3 or less (retry on next cron run)
        console.log(
          "[process-scheduled-facebook-pages-uploads] Incrementing retry count - will retry on next cron run:",
          {
            userId: post.userId,
            postId: post.id,
            platformPostId: platformPost.id,
            retryCount: newRetryCount,
            timestamp: new Date().toISOString(),
          },
        );

        await prisma.platformPost.update({
          where: { id: platformPost.id },
          data: {
            retryCount: newRetryCount,
            updatedAt: new Date(),
          },
        });
      }
      break;
  }
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
 *  13.2
 *
 * @example
 * if (!verifyCronSecret(request)) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    console.error("[process-scheduled-facebook-pages-uploads] No Authorization header");
    return false;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[process-scheduled-facebook-pages-uploads] CRON_SECRET not configured");
    return false;
  }

  // Debug logging (safe - only logs lengths and first/last 4 chars)
  console.log("[process-scheduled-facebook-pages-uploads] Auth debug:", {
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
 * Execute upload for a single post to Facebook Pages
 *
 * This function handles the complete upload flow for a single post:
 * 1. Decrypt Page access token
 * 2. Check token expiration and refresh if needed
 * 3. Generate signed Backblaze URL
 * 4. Validate video requirements
 * 5. Initialize upload session
 * 6. Upload video file
 * 7. Publish video
 * 8. Update database with result
 *
 * @param {Post} post - The post to upload
 * @param {PlatformPost} platformPost - The platform post record
 * @param {SocialAccount} socialAccount - The social account with access token
 * @returns {Promise<{ success: boolean; error?: string }>} Upload result
 */
async function executeUpload(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
): Promise<{ success: boolean; error?: string }> {
  const prisma = getPrisma();

  try {
    // Log each upload attempt with userId, postId, and result
    console.log("[process-scheduled-facebook-pages-uploads] Starting upload:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      socialAccountId: socialAccount.id,
      timestamp: new Date().toISOString(),
    });

    // Decrypt Page access_token using AES-256-GCM
    let accessToken: string;
    try {
      accessToken = decryptToken(socialAccount.accessToken);
    } catch (error) {
      // Mark PlatformPost as FAILED if decryption fails
      const errorMessage = "Failed to decrypt access token";
      console.error("[process-scheduled-facebook-pages-uploads] Token decryption failed:", {
        userId: post.userId,
        postId: post.id,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, errorMessage);

      return { success: false, error: errorMessage };
    }

    // Check if access_token has expiration date (expiresAt not NULL)
    // Refresh token if expires within 7 days (defensive programming for edge cases)
    if (socialAccount.expiresAt !== null) {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (socialAccount.expiresAt <= sevenDaysFromNow) {
        console.log("[process-scheduled-facebook-pages-uploads] Token expires soon, refreshing:", {
          userId: post.userId,
          postId: post.id,
          expiresAt: socialAccount.expiresAt.toISOString(),
          timestamp: new Date().toISOString(),
        });

        const refreshResult = await refreshFacebookToken({ accessToken });

        // Mark PlatformPost as FAILED if token refresh fails
        if (!refreshResult.success) {
          const errorMessage = `Token refresh failed: ${refreshResult.error}`;
          console.error("[process-scheduled-facebook-pages-uploads] Token refresh failed:", {
            userId: post.userId,
            postId: post.id,
            error: refreshResult.error,
            timestamp: new Date().toISOString(),
          });

          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "FAILED",
              errorMessage,
              updatedAt: new Date(),
            },
          });

          // Create notification for failed upload
          await createFailedUploadNotification(post, platformPost, errorMessage);

          return { success: false, error: errorMessage };
        }

        // Update access token with refreshed token
        accessToken = refreshResult.accessToken!;

        // Update database with new token (would need to encrypt it, but for now just log)
        console.log("[process-scheduled-facebook-pages-uploads] Token refreshed successfully:", {
          userId: post.userId,
          postId: post.id,
          expiresIn: refreshResult.expiresIn,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Generate signed Backblaze URL with 1-hour expiration
    let signedUrl: string;
    try {
      const urlResult = await buildSignedVideoUrl(post.videoFileKey);
      signedUrl = urlResult.signedUrl;
    } catch (error) {
      // Mark PlatformPost as FAILED if URL generation fails
      const errorMessage = `Failed to generate signed URL: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error("[process-scheduled-facebook-pages-uploads] URL generation failed:", {
        userId: post.userId,
        postId: post.id,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, errorMessage);

      return { success: false, error: errorMessage };
    }

    // Validate video format is MP4 or MOV
    // Validate caption length does not exceed 2,200 characters
    const validationResult = validateVideoForFacebook({
      videoFileKey: post.videoFileKey,
      videoFileSize: post.videoFileSize,
      title: post.title,
      description: post.description || undefined,
    });

    if (!validationResult.valid) {
      // Mark PlatformPost as FAILED if validation fails
      console.error("[process-scheduled-facebook-pages-uploads] Validation failed:", {
        userId: post.userId,
        postId: post.id,
        error: validationResult.error,
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage: validationResult.error,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, validationResult.error!);

      return { success: false, error: validationResult.error };
    }

    // Format caption as title concatenated with description using double newline separator
    const caption = formatCaptionForFacebook(post.title, post.description || undefined);

    // Get Facebook App ID from environment
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      const errorMessage = "FACEBOOK_APP_ID not configured";
      console.error("[process-scheduled-facebook-pages-uploads] Missing app ID:", {
        userId: post.userId,
        postId: post.id,
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, errorMessage);

      return { success: false, error: errorMessage };
    }

    // Initialize upload session
    const fileType = getVideoFileType(post.videoFileKey);
    const sessionResult = await initializeUploadSession({
      accessToken,
      appId,
      fileName: post.videoFileKey.split("/").pop() || "video.mp4",
      fileLength: post.videoFileSize,
      fileType,
    });

    if (!sessionResult.success) {
      const errorMessage = `Upload session initialization failed: ${sessionResult.error}`;

      // Log all errors with userId, postId, error message, and stack trace
      console.error("[process-scheduled-facebook-pages-uploads] Session initialization failed:", {
        userId: post.userId,
        postId: post.id,
        error: sessionResult.error,
        errorCode: sessionResult.errorCode,
        timestamp: new Date().toISOString(),
      });

      // Classify error and handle appropriately
      const errorType = classifyError(sessionResult.errorCode);
      await handleUploadError(
        errorType,
        errorMessage,
        sessionResult.errorCode,
        platformPost,
        socialAccount,
        post,
      );

      return { success: false, error: errorMessage };
    }

    // Fetch video file from signed URL
    console.log("[process-scheduled-facebook-pages-uploads] Fetching video from Backblaze:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      timestamp: new Date().toISOString(),
    });

    const videoResponse = await fetch(signedUrl);
    if (!videoResponse.ok) {
      const errorMessage = `Failed to fetch video from Backblaze: HTTP ${videoResponse.status}`;
      console.error("[process-scheduled-facebook-pages-uploads] Video fetch failed:", {
        userId: post.userId,
        postId: post.id,
        status: videoResponse.status,
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage,
          updatedAt: new Date(),
        },
      });

      // Create notification for failed upload
      await createFailedUploadNotification(post, platformPost, errorMessage);

      return { success: false, error: errorMessage };
    }

    const videoData = await videoResponse.arrayBuffer();

    // Upload video file
    const uploadResult = await uploadVideoFile({
      accessToken,
      uploadSessionId: sessionResult.uploadSessionId!,
      videoData,
    });

    if (!uploadResult.success) {
      const errorMessage = `Video upload failed: ${uploadResult.error}`;

      //  Log all errors with userId, postId, error message, and stack trace
      console.error("[process-scheduled-facebook-pages-uploads] Video upload failed:", {
        userId: post.userId,
        postId: post.id,
        error: uploadResult.error,
        errorCode: uploadResult.errorCode,
        timestamp: new Date().toISOString(),
      });

      // Classify error and handle appropriately
      const errorType = classifyError(uploadResult.errorCode);
      await handleUploadError(
        errorType,
        errorMessage,
        uploadResult.errorCode,
        platformPost,
        socialAccount,
        post,
      );

      return { success: false, error: errorMessage };
    }

    // Publish video
    const publishResult = await publishVideo({
      accessToken,
      pageId: socialAccount.platformAccountId,
      fileHandle: uploadResult.fileHandle!,
      description: caption,
    });

    if (!publishResult.success) {
      const errorMessage = `Video publish failed: ${publishResult.error}`;

      // Log all errors with userId, postId, error message, and stack trace
      console.error("[process-scheduled-facebook-pages-uploads] Video publish failed:", {
        userId: post.userId,
        postId: post.id,
        error: publishResult.error,
        errorCode: publishResult.errorCode,
        timestamp: new Date().toISOString(),
      });

      // Classify error and handle appropriately
      const errorType = classifyError(publishResult.errorCode);
      await handleUploadError(
        errorType,
        errorMessage,
        publishResult.errorCode,
        platformPost,
        socialAccount,
        post,
      );

      return { success: false, error: errorMessage };
    }

    //  Update PlatformPost status to PUBLISHED with video id and platform URL
    // Mark as PUBLISHED immediately after successful publish API response
    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        status: "PUBLISHED",
        platformPostId: publishResult.videoId,
        platformUrl: publishResult.platformUrl,
        publishedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    // Log upload success with userId, postId, video ID, and timestamp
    console.log("[process-scheduled-facebook-pages-uploads] Upload successful:", {
      userId: post.userId,
      postId: post.id,
      videoId: publishResult.videoId,
      platformUrl: publishResult.platformUrl,
      timestamp: new Date().toISOString(),
    });

    // Create notification for successful upload
    try {
      const notificationContent = formatUploadSuccess(post.title, "Facebook Pages");
      await createNotification(
        post.userId,
        notificationContent.title,
        notificationContent.description,
        "UPLOAD_SUCCESS"
      );
    } catch (notificationError) {
      console.error("[process-scheduled-facebook-pages-uploads] Failed to create success notification:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        error: notificationError instanceof Error ? notificationError.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    // Log that Facebook processes videos asynchronously
    // Video processing may still be in progress on Facebook's servers
    console.log("[process-scheduled-facebook-pages-uploads] Video published successfully:", {
      userId: post.userId,
      postId: post.id,
      videoId: publishResult.videoId,
      note: "Facebook processes videos asynchronously - video may still be processing on Facebook's servers",
      platformUrl: publishResult.platformUrl,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    //  Handle errors according to error handlingrequirements
    // Log all errors with userId, postId, error message, and stack trace
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-scheduled-facebook-pages-uploads] Unexpected error during upload:", {
      userId: post.userId,
      postId: post.id,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Classify as unknown error and handle appropriately (will increment retry count)
    await handleUploadError(
      ErrorType.UNKNOWN_ERROR,
      errorMessage,
      undefined,
      platformPost,
      socialAccount,
      post,
    );

    return { success: false, error: errorMessage };
  }
}

/**
 * POST /api/cron/process-scheduled-facebook-pages-uploads
 *
 * Main handler for processing scheduled Facebook Pages uploads. This endpoint:
 * 1. Verifies the CRON_SECRET for authentication
 * 2. Queries for scheduled posts within the scheduling window
 * 3. Filters for posts with PENDING PlatformPost records for active FacebookPage accounts
 * 4. Processes uploads
 * 5. Returns a summary of operations
 *
 * NOTE: Unlike Instagram/Threads, Facebook videos publish immediately without
 * container polling, so this endpoint is simpler.
 *
 *
 * @param {NextRequest} request - The incoming request from cron-job.org
 * @returns {Promise<NextResponse>} Response with processing summary or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-facebook-pages-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  //  Log cron execution start with timestamp
  console.log("[process-scheduled-facebook-pages-uploads] Cron execution started:", {
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
          },
          include: {
            SocialAccount: true,
          },
        },
      },
    });

    // Filter to only include posts with FacebookPage PlatformPost records that have active FacebookPage accounts
    //  13.6
    const postsToProcess = scheduledPosts
      .map((post) => ({
        ...post,
        PlatformPost: post.PlatformPost.filter(
          (pp) => pp.SocialAccount.platform === "FacebookPage" && pp.SocialAccount.isActive,
        ),
      }))
      .filter((post) => post.PlatformPost.length > 0);

    // Log count of posts found in scheduling window with timestamp
    console.log("[process-scheduled-facebook-pages-uploads] Found posts to process:", {
      timestamp: new Date().toISOString(),
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      totalScheduled: scheduledPosts.length,
      withFacebookPages: postsToProcess.length,
    });

    // Initialize result summary
    const result: ProcessResult = {
      processed: postsToProcess.length,
      uploaded: 0,
      errors: [],
    };

    // Process each post
    for (const post of postsToProcess) {
      for (const platformPost of post.PlatformPost) {
        const uploadResult = await executeUpload(post, platformPost, platformPost.SocialAccount);

        if (uploadResult.success) {
          result.uploaded++;
        } else {
          result.errors.push(`Post ${post.id}: ${uploadResult.error}`);
        }
      }
    }

    // Log cron execution end with timestamp
    console.log("[process-scheduled-facebook-pages-uploads] Cron execution completed:", {
      timestamp: new Date().toISOString(),
      result,
    });

    //  Return HTTP 200 with summary of processed, uploaded, and error counts
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Return HTTP 500 on database query failures
    console.error("[process-scheduled-facebook-pages-uploads] Database error:", {
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
 * Create a failure notification for a failed upload
 *
 * This helper function creates a notification when a Facebook Pages upload fails.
 * It queries the Post to get the title and uses the formatUploadFailed helper.
 * Errors are logged but do not propagate to avoid breaking the upload processing flow.
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param errorMessage - The error message describing the failure
 */
async function createFailedUploadNotification(
  post: Post,
  platformPost: PlatformPost,
  errorMessage: string
): Promise<void> {
  try {
    const notificationContent = formatUploadFailed(post.title, "Facebook Pages", errorMessage);
    await createNotification(
      post.userId,
      notificationContent.title,
      notificationContent.description,
      "UPLOAD_FAILED"
    );
  } catch (notificationError) {
    console.error("[createFailedUploadNotification] Failed to create failure notification:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
