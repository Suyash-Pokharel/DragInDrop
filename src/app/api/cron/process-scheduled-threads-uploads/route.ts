/**
 * Scheduled Threads Upload Processing API Endpoint
 *
 * This endpoint is triggered by cron-job.org every 5 minutes to process scheduled
 * Threads uploads. It handles:
 * - Querying scheduled posts within the scheduling window (Task 8.1, 8.2)
 * - Uploading videos to Threads (to be implemented in subsequent tasks)
 * - Polling container status (to be implemented in subsequent tasks)
 * - Publishing containers (to be implemented in subsequent tasks)
 * - Updating database records (to be implemented in subsequent tasks)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.3, 12.4
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Post, PlatformPost, SocialAccount } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { checkUploadRateLimit, incrementUploadCounter } from "@/lib/threads/rateLimiter";
import { buildSignedVideoUrl } from "@/lib/backblaze/urlBuilder";
import { createMediaContainer, refreshThreadsToken } from "@/lib/threads/api";

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
 * Requirements: 5.2
 *
 * @example
 * if (!verifyCronSecret(request)) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    console.error("[process-scheduled-threads-uploads] No Authorization header");
    return false;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[process-scheduled-threads-uploads] CRON_SECRET not configured");
    return false;
  }

  // Debug logging (safe - only logs lengths and first/last 4 chars)
  console.log("[process-scheduled-threads-uploads] Auth debug:", {
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
 * Requirements: 5.3, 5.4
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
 * POST /api/cron/process-scheduled-threads-uploads
 *
 * Main handler for processing scheduled Threads uploads. This endpoint:
 * 1. Verifies the CRON_SECRET for authentication
 * 2. Queries for scheduled posts within the scheduling window
 * 3. Filters for posts with PENDING PlatformPost records for active Threads accounts
 * 4. Processes uploads and status polling (to be implemented in subsequent tasks)
 * 5. Returns a summary of operations
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.3, 12.4
 *
 * @param {NextRequest} request - The incoming request from cron-job.org
 * @returns {Promise<NextResponse>} Response with processing summary or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET
  // Requirements: 5.2
  if (!verifyCronSecret(request)) {
    console.error("[process-scheduled-threads-uploads] Unauthorized request:", {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!request.headers.get("Authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Requirement: Log cron execution start with timestamp
  console.log("[process-scheduled-threads-uploads] Cron execution started:", {
    timestamp: new Date().toISOString(),
  });

  try {
    const prisma = getPrisma();
    const window = getSchedulingWindow();

    // Query for scheduled posts within the scheduling window
    // Requirements: 5.5, 5.6, 5.7
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

    // Filter to only include posts with Threads PlatformPost records that have active Threads accounts
    // Requirements: 5.6, 5.7
    const postsToProcess = scheduledPosts
      .map((post) => ({
        ...post,
        PlatformPost: post.PlatformPost.filter(
          (pp) => pp.SocialAccount.platform === "Threads" && pp.SocialAccount.isActive,
        ),
      }))
      .filter((post) => post.PlatformPost.length > 0);

    // Log count of posts found in scheduling window
    console.log("[process-scheduled-threads-uploads] Found posts to process:", {
      timestamp: new Date().toISOString(),
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      totalScheduled: scheduledPosts.length,
      withThreads: postsToProcess.length,
    });

    // Initialize result summary
    const result: ProcessResult = {
      processed: postsToProcess.length,
      uploaded: 0,
      errors: [],
    };

    // Process scheduled posts for upload
    const uploadResult = await processScheduledPosts(postsToProcess);
    result.uploaded = uploadResult.uploaded;
    result.errors.push(...uploadResult.errors);

    // Process publishing posts for status polling and publishing
    // Requirements: 6.9, 6.10, 6.11, 6.26, 6.23
    const publishingResult = await processPublishingPosts();
    result.errors.push(...publishingResult.errors);

    // Log cron execution end with timestamp
    console.log("[process-scheduled-threads-uploads] Cron execution completed:", {
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
    console.error("[process-scheduled-threads-uploads] Database error:", {
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
 * Validate video requirements for Threads upload
 *
 * This function validates:
 * 1. Video format is MP4 or MOV (file extension check)
 * 2. Caption length ≤500 characters
 * 3. Caption format (title + description with double newline separator)
 *
 * Note: Video file size (max 250 MB) is enforced by system upload constraint.
 * Threads API supports up to 1 GB, but this system has a 250 MB limit.
 * Video duration (3 seconds to 5 minutes) and resolution (up to 1920x1080)
 * are validated by the Threads API.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 *
 * @param post - The Post record to validate
 * @returns Error message if validation fails, null if valid
 */
function validateVideoForThreads(post: Post): string | null {
  // Requirement 10.1: Validate video format is MP4 or MOV (file extension check)
  const videoFileKey = post.videoFileKey.toLowerCase();
  const isValidFormat = videoFileKey.endsWith(".mp4") || videoFileKey.endsWith(".mov");

  if (!isValidFormat) {
    // Requirement 10.2: Return descriptive error for invalid format
    return "Video format must be MP4 or MOV";
  }

  // Requirement 10.5: Format caption as title concatenated with description (double newline separator)
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title;

  // Requirement 10.3: Validate caption length ≤500 characters
  if (caption.length > 500) {
    // Requirement 10.4: Return descriptive error for caption length
    return "Caption exceeds 500 character limit";
  }

  // Requirements 10.6, 10.7: Video file size (max 250 MB) is enforced by system upload constraint
  // Threads API supports up to 1 GB, but this system has a 250 MB limit.
  // Video duration (3 seconds to 5 minutes) and resolution (up to 1920x1080)
  // are validated by the Threads API during container processing.

  return null; // Validation passed
}

/**
 * Process scheduled posts for upload to Threads
 *
 * This function processes each scheduled post by:
 * 1. Retrieving and decrypting the SocialAccount tokens
 * 2. Checking if the access token is expired and refreshing if needed
 * 3. Checking upload rate limits
 * 4. Generating a signed Backblaze URL for the video
 * 5. Validating video requirements
 * 6. Calling Threads API to create media container
 * 7. Updating the database with the container ID and status
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
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
        const result = await uploadToThreads(post, platformPost, platformPost.SocialAccount);

        if (result.success) {
          uploaded++;
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
 * Upload a single post to Threads
 *
 * This function handles the upload flow for a single post:
 * 1. Check if token expires within 24 hours and refresh if needed
 * 2. Decrypt access token
 * 3. Check upload rate limit
 * 4. Generate signed Backblaze URL with 1-hour expiration
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record with encrypted tokens
 * @returns UploadResult indicating success or failure
 */
async function uploadToThreads(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
): Promise<UploadResult> {
  const prisma = getPrisma();

  // Step 1: Check if access token expires within 24 hours and refresh if needed
  // Requirement: 6.2
  let currentSocialAccount = socialAccount;

  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (socialAccount.expiresAt && new Date(socialAccount.expiresAt) < twentyFourHoursFromNow) {
    console.log("[uploadToThreads] Token expired or expiring soon, refreshing:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      expiresAt: socialAccount.expiresAt,
      timestamp: new Date().toISOString(),
    });

    const refreshResult = await refreshThreadsToken({
      encryptedAccessToken: socialAccount.accessToken,
    });

    if (!refreshResult.success) {
      // Token refresh failed - mark as FAILED
      console.error("[uploadToThreads] Token refresh failed:", {
        userId: post.userId,
        postId: post.id,
        error: refreshResult.error,
        timestamp: new Date().toISOString(),
      });

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: {
          status: "FAILED",
          errorMessage: "Token refresh failed",
          updatedAt: new Date(),
        },
      });

      return {
        success: false,
        error: "Token refresh failed",
      };
    }

    // Update the social account with new token and expiration
    currentSocialAccount = await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: refreshResult.encryptedAccessToken!,
        expiresAt: refreshResult.expiresAt!,
        updatedAt: new Date(),
      },
    });

    console.log("[uploadToThreads] Token refreshed successfully:", {
      userId: post.userId,
      postId: post.id,
      platform: socialAccount.platform,
      expiresAt: refreshResult.expiresAt,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 2: Decrypt access token
  // Requirement: 6.1
  let accessToken: string;
  try {
    accessToken = decryptToken(currentSocialAccount.accessToken);
  } catch (error) {
    console.error("[uploadToThreads] Failed to decrypt access token:", {
      userId: post.userId,
      postId: post.id,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        status: "FAILED",
        errorMessage: "Failed to decrypt access token",
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      error: "Failed to decrypt access token",
    };
  }

  // Step 3: Check upload rate limit (250 posts per 24 hours)
  // Requirement: 6.3
  const rateLimitResult = await checkUploadRateLimit(post.userId);

  if (!rateLimitResult.allowed) {
    console.warn("[uploadToThreads] Upload rate limit exceeded:", {
      userId: post.userId,
      postId: post.id,
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      shouldSkip: true,
      error: "Upload rate limit exceeded (250 posts per 24 hours)",
    };
  }

  // Step 4: Generate signed Backblaze URL with 1-hour expiration
  // Requirement: 6.4
  let signedUrl: string;
  try {
    const urlResult = await buildSignedVideoUrl(post.videoFileKey);
    signedUrl = urlResult.signedUrl;

    console.log("[uploadToThreads] Generated signed URL:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      expiresAt: urlResult.expiresAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[uploadToThreads] Failed to generate signed URL:", {
      userId: post.userId,
      postId: post.id,
      videoFileKey: post.videoFileKey,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        status: "FAILED",
        errorMessage: "Failed to generate signed video URL",
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      error: "Failed to generate signed video URL",
    };
  }

  // Step 5: Validate video requirements
  // Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
  const validationError = validateVideoForThreads(post);
  if (validationError) {
    console.error("[uploadToThreads] Video validation failed:", {
      userId: post.userId,
      postId: post.id,
      error: validationError,
      timestamp: new Date().toISOString(),
    });

    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        status: "FAILED",
        errorMessage: validationError,
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      error: validationError,
    };
  }

  // Step 6: Format caption (title + description with double newline separator)
  // Requirement: 10.5
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title;

  // Step 7: Create media container via Threads API
  // Requirements: 6.5, 6.6, 6.7, 6.8
  console.log("[uploadToThreads] Creating media container:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    threadsUserId: currentSocialAccount.platformAccountId,
    captionLength: caption.length,
    timestamp: new Date().toISOString(),
  });

  const containerResult = await createMediaContainer({
    accessToken,
    threadsUserId: currentSocialAccount.platformAccountId,
    videoUrl: signedUrl,
    text: caption,
  });

  // Handle container creation failure
  if (!containerResult.success) {
    console.error("[uploadToThreads] Container creation failed:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: containerResult.error,
      errorCode: containerResult.errorCode,
      timestamp: new Date().toISOString(),
    });

    // Requirement 6.19: Skip post and log warning if rate limit exceeded
    if (containerResult.errorCode === "rate_limit") {
      console.warn("[uploadToThreads] Rate limit exceeded, skipping post:", {
        userId: post.userId,
        postId: post.id,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        shouldSkip: true,
        error: "Threads API rate limit exceeded",
      };
    }

    // For other errors, mark as FAILED
    await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: {
        status: "FAILED",
        errorMessage: containerResult.error || "Failed to create media container",
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      error: containerResult.error || "Failed to create media container",
    };
  }

  // Step 8: Update PlatformPost status to PUBLISHING and store container ID
  // Requirement: 6.8
  await prisma.platformPost.update({
    where: { id: platformPost.id },
    data: {
      status: "PUBLISHING",
      publishId: containerResult.containerId,
      updatedAt: new Date(),
    },
  });

  console.log("[uploadToThreads] Container created successfully:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    containerId: containerResult.containerId,
    timestamp: new Date().toISOString(),
  });

  // Step 9: Increment upload rate limit counter after successful creation
  // Requirement: 6.18
  await incrementUploadCounter(post.userId);

  console.log("[uploadToThreads] Upload rate limit counter incremented:", {
    userId: post.userId,
    postId: post.id,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    containerId: containerResult.containerId,
  };
}

/**
 * Process publishing posts for status polling and publishing
 *
 * This function handles the status polling and publishing flow for posts that are
 * currently in PUBLISHING state:
 * 1. Query PlatformPost records with status=PUBLISHING and platform=Threads
 * 2. Check if in PUBLISHING for >5 minutes → mark as FAILED with timeout error
 * 3. Wait minimum 30 seconds after container creation before attempting to publish
 * 4. Poll container status once per minute (60 seconds) per Meta API recommendations
 * 5. Set 10-second timeout for each status polling request
 *
 * Requirements: 6.9, 6.10, 6.11, 6.26, 6.23
 * Source: Meta Threads API Troubleshooting - "We recommend querying a container's status once per minute, for no more than 5 minutes."
 *
 * @returns ProcessResult with errors
 */
async function processPublishingPosts(): Promise<{ errors: string[] }> {
  const prisma = getPrisma();
  const errors: string[] = [];

  try {
    // Query PlatformPost records with status=PUBLISHING and platform=Threads
    // Requirement: 6.9
    const publishingPosts = await prisma.platformPost.findMany({
      where: {
        status: "PUBLISHING",
        SocialAccount: {
          platform: "Threads",
          isActive: true,
        },
      },
      include: {
        SocialAccount: true,
        Post: true,
      },
    });

    console.log("[processPublishingPosts] Found publishing posts:", {
      timestamp: new Date().toISOString(),
      count: publishingPosts.length,
    });

    const now = new Date();
    const fiveMinutesInMs = 5 * 60 * 1000;
    const thirtySecondsInMs = 30 * 1000;
    const sixtySecondsInMs = 60 * 1000;

    for (const platformPost of publishingPosts) {
      try {
        // Check if in PUBLISHING for >5 minutes → mark as FAILED with timeout error
        // Requirement: 6.10, 6.26
        const timeInPublishing = now.getTime() - platformPost.updatedAt.getTime();

        if (timeInPublishing > fiveMinutesInMs) {
          console.error("[processPublishingPosts] Container processing timeout:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            containerId: platformPost.publishId,
            timeInPublishing: Math.floor(timeInPublishing / 1000),
            timestamp: new Date().toISOString(),
          });

          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "FAILED",
              errorMessage: "Container processing timeout (exceeded 5 minutes)",
              updatedAt: new Date(),
            },
          });

          errors.push(
            `Post ${platformPost.postId}: Container processing timeout (exceeded 5 minutes)`,
          );
          continue;
        }

        // Wait minimum 30 seconds after container creation before attempting to publish
        // Requirement: 6.11
        if (timeInPublishing < thirtySecondsInMs) {
          console.log("[processPublishingPosts] Waiting for minimum 30 seconds:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            containerId: platformPost.publishId,
            timeInPublishing: Math.floor(timeInPublishing / 1000),
            timestamp: new Date().toISOString(),
          });
          continue; // Skip this post, will check again on next cron run
        }

        // Poll container status once per minute (60 seconds) per Meta API recommendations
        // Requirement: 6.23
        // Check if we've polled within the last 60 seconds
        const timeSinceLastUpdate = now.getTime() - platformPost.updatedAt.getTime();
        if (timeSinceLastUpdate < sixtySecondsInMs) {
          console.log("[processPublishingPosts] Waiting for 60-second polling interval:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            containerId: platformPost.publishId,
            timeSinceLastUpdate: Math.floor(timeSinceLastUpdate / 1000),
            timestamp: new Date().toISOString(),
          });
          continue; // Skip this post, will check again on next cron run
        }

        // Decrypt access token
        const accessToken = decryptToken(platformPost.SocialAccount.accessToken);

        // Poll container status
        // Requirement: 6.9, 6.26
        if (!platformPost.publishId) {
          console.error("[processPublishingPosts] Missing container ID:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            timestamp: new Date().toISOString(),
          });

          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "FAILED",
              errorMessage: "Missing container ID",
              updatedAt: new Date(),
            },
          });

          errors.push(`Post ${platformPost.postId}: Missing container ID`);
          continue;
        }

        console.log("[processPublishingPosts] Polling container status:", {
          userId: platformPost.Post.userId,
          postId: platformPost.postId,
          platformPostId: platformPost.id,
          containerId: platformPost.publishId,
          timestamp: new Date().toISOString(),
        });

        const { pollContainerStatus } = await import("@/lib/threads/api");
        const statusResult = await pollContainerStatus({
          accessToken,
          containerId: platformPost.publishId,
        });

        // Update the updatedAt timestamp to track polling interval
        await prisma.platformPost.update({
          where: { id: platformPost.id },
          data: {
            updatedAt: new Date(),
          },
        });

        if (!statusResult.success) {
          console.error("[processPublishingPosts] Status polling failed:", {
            userId: platformPost.Post.userId,
            postId: platformPost.postId,
            platformPostId: platformPost.id,
            containerId: platformPost.publishId,
            error: statusResult.error,
            errorCode: statusResult.errorCode,
            timestamp: new Date().toISOString(),
          });

          // For transient errors, leave status as PUBLISHING and retry on next cron run
          if (
            statusResult.errorCode === "timeout" ||
            statusResult.errorCode === "network_error" ||
            statusResult.errorCode === "server_error"
          ) {
            continue;
          }

          // For permanent errors, mark as FAILED
          await prisma.platformPost.update({
            where: { id: platformPost.id },
            data: {
              status: "FAILED",
              errorMessage: statusResult.error || "Status polling failed",
              updatedAt: new Date(),
            },
          });

          errors.push(`Post ${platformPost.postId}: ${statusResult.error}`);
          continue;
        }

        console.log("[processPublishingPosts] Container status:", {
          userId: platformPost.Post.userId,
          postId: platformPost.postId,
          platformPostId: platformPost.id,
          containerId: platformPost.publishId,
          status: statusResult.status,
          timestamp: new Date().toISOString(),
        });

        // Handle different container statuses
        // Requirements: 6.23, 6.24, 6.25
        switch (statusResult.status) {
          case "IN_PROGRESS":
            // Continue polling on next cron run
            console.log("[processPublishingPosts] Container still processing:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              timestamp: new Date().toISOString(),
            });
            break;

          case "FINISHED":
            // Container is ready to publish
            // Requirements: 6.12, 6.13, 6.14, 6.15, 6.16
            console.log("[processPublishingPosts] Container ready to publish:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              timestamp: new Date().toISOString(),
            });

            // Publish the container
            const { publishContainer } = await import("@/lib/threads/api");
            const publishResult = await publishContainer({
              accessToken,
              threadsUserId: platformPost.SocialAccount.platformAccountId,
              containerId: platformPost.publishId,
            });

            if (!publishResult.success) {
              console.error("[processPublishingPosts] Container publish failed:", {
                userId: platformPost.Post.userId,
                postId: platformPost.postId,
                platformPostId: platformPost.id,
                containerId: platformPost.publishId,
                error: publishResult.error,
                errorCode: publishResult.errorCode,
                timestamp: new Date().toISOString(),
              });

              // For transient errors, leave status as PUBLISHING and retry on next cron run
              if (
                publishResult.errorCode === "timeout" ||
                publishResult.errorCode === "network_error" ||
                publishResult.errorCode === "server_error"
              ) {
                continue;
              }

              // For permanent errors, mark as FAILED
              await prisma.platformPost.update({
                where: { id: platformPost.id },
                data: {
                  status: "FAILED",
                  errorMessage: publishResult.error || "Failed to publish container",
                  updatedAt: new Date(),
                },
              });

              errors.push(`Post ${platformPost.postId}: ${publishResult.error}`);
              break;
            }

            // Extract media ID from publish response
            // Requirement: 6.16
            const mediaId = publishResult.mediaId!;

            // Construct platform URL
            // Requirement: 6.16
            const platformUrl = `https://www.threads.net/@${platformPost.SocialAccount.platformUsername}/post/${mediaId}`;

            // Update PlatformPost with status=PUBLISHED, platformPostId, platformUrl, publishedAt
            // Requirement: 6.16
            await prisma.platformPost.update({
              where: { id: platformPost.id },
              data: {
                status: "PUBLISHED",
                platformPostId: mediaId,
                platformUrl,
                publishedAt: new Date(),
                updatedAt: new Date(),
              },
            });

            console.log("[processPublishingPosts] Container published successfully:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              mediaId,
              platformUrl,
              timestamp: new Date().toISOString(),
            });
            break;

          case "ERROR":
            // Processing failed - mark as FAILED with specific error message
            // Requirement: 6.23
            const errorMessage = statusResult.errorMessage || "Container processing failed";
            console.error("[processPublishingPosts] Container processing error:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              errorMessage,
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

            errors.push(`Post ${platformPost.postId}: ${errorMessage}`);
            break;

          case "EXPIRED":
            // Container expired - mark as FAILED
            // Requirement: 6.24
            console.error("[processPublishingPosts] Container expired:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              timestamp: new Date().toISOString(),
            });

            await prisma.platformPost.update({
              where: { id: platformPost.id },
              data: {
                status: "FAILED",
                errorMessage: "Container expired (not published within 24 hours)",
                updatedAt: new Date(),
              },
            });

            errors.push(
              `Post ${platformPost.postId}: Container expired (not published within 24 hours)`,
            );
            break;

          case "PUBLISHED":
            // Container already published - mark as FAILED
            // Requirement: 6.25
            console.error("[processPublishingPosts] Container already published:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              timestamp: new Date().toISOString(),
            });

            await prisma.platformPost.update({
              where: { id: platformPost.id },
              data: {
                status: "FAILED",
                errorMessage: "Container already published",
                updatedAt: new Date(),
              },
            });

            errors.push(`Post ${platformPost.postId}: Container already published`);
            break;

          default:
            console.error("[processPublishingPosts] Unknown container status:", {
              userId: platformPost.Post.userId,
              postId: platformPost.postId,
              platformPostId: platformPost.id,
              containerId: platformPost.publishId,
              status: statusResult.status,
              timestamp: new Date().toISOString(),
            });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Post ${platformPost.postId}: ${errorMessage}`);
        console.error("[processPublishingPosts] Unexpected error processing post:", {
          userId: platformPost.Post.userId,
          postId: platformPost.postId,
          platformPostId: platformPost.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[processPublishingPosts] Database error:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return { errors: [`Database error: ${errorMessage}`] };
  }
}

/**
 * Handle Threads API upload errors with appropriate retry logic
 *
 * This function implements the error handling strategy for Threads API errors:
 * - HTTP 400: Mark as FAILED (no retry)
 * - HTTP 401/403: Attempt token refresh and retry once
 * - HTTP 429: Skip post and retry on next cron run
 * - HTTP 5xx: Increment retryCount and retry on next cron run
 * - Network timeout: Increment retryCount and retry on next cron run
 * - If retryCount >3: Mark as FAILED with "max retries exceeded"
 * - Leave status as PENDING for retryable errors
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * @param post - The Post record
 * @param platformPost - The PlatformPost record
 * @param socialAccount - The SocialAccount record
 * @param uploadResult - The failed upload result from createMediaContainer
 * @returns UploadResult indicating how to handle the error
 */
async function _handleUploadError(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount,
  uploadResult: { success: false; error?: string; errorCode?: string },
): Promise<UploadResult> {
  const prisma = getPrisma();
  const errorCode = uploadResult.errorCode || "unknown_error";
  const errorMessage = uploadResult.error || "Threads API error";

  // Requirement 7.1: HTTP 400 → mark as FAILED with error message (no retry)
  if (errorCode === "bad_request") {
    console.error("[handleUploadError] Bad request error (HTTP 400):", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

    // Sync post status after marking as FAILED
    await syncPostStatus(platformPost.postId);

    return {
      success: false,
      error: errorMessage,
    };
  }

  // Requirement 7.2: HTTP 401/403 → attempt token refresh and retry once
  if (errorCode === "auth_error") {
    console.warn(
      "[handleUploadError] Authentication error (HTTP 401/403), attempting token refresh:",
      {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        timestamp: new Date().toISOString(),
      },
    );

    const refreshResult = await refreshThreadsToken({
      encryptedAccessToken: socialAccount.accessToken,
    });

    if (!refreshResult.success) {
      console.error("[handleUploadError] Token refresh failed after auth error:", {
        userId: post.userId,
        postId: post.id,
        platformPostId: platformPost.id,
        error: refreshResult.error,
        timestamp: new Date().toISOString(),
      });

      await updatePlatformPostStatus(
        platformPost.id,
        "FAILED",
        undefined,
        "Token refresh failed after authentication error",
      );

      // Sync post status after marking as FAILED
      await syncPostStatus(platformPost.postId);

      return {
        success: false,
        error: "Token refresh failed after authentication error",
      };
    }

    // Update the social account with new token and expiration
    const updatedAccount = await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: refreshResult.encryptedAccessToken!,
        expiresAt: refreshResult.expiresAt!,
        updatedAt: new Date(),
      },
    });

    console.log("[handleUploadError] Token refreshed successfully, retrying upload:", {
      userId: post.userId,
      postId: post.id,
      platformPostId: platformPost.id,
      expiresAt: refreshResult.expiresAt,
      timestamp: new Date().toISOString(),
    });

    // Retry upload once with refreshed token
    return await uploadToThreads(post, platformPost, updatedAccount);
  }

  // Requirement 7.3: HTTP 429 → skip post and retry on next cron run
  if (errorCode === "rate_limit") {
    console.warn("[handleUploadError] Threads API rate limit exceeded (HTTP 429):", {
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
      error: "Threads API rate limit exceeded",
    };
  }

  // Requirements 7.4, 7.5, 7.6: HTTP 5xx or timeout → increment retryCount and retry on next cron run
  if (errorCode === "server_error" || errorCode === "timeout" || errorCode === "network_error") {
    const currentRetryCount = platformPost.retryCount;
    const newRetryCount = currentRetryCount + 1;

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

    // Requirement 7.5: If retryCount >3 → mark as FAILED with "max retries exceeded"
    if (newRetryCount > 3) {
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

      // Sync post status after marking as FAILED
      await syncPostStatus(platformPost.postId);

      return {
        success: false,
        error: `${errorMessage} (max retries exceeded)`,
      };
    }

    // Requirement 7.7: Leave status as PENDING for retryable errors
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
  console.error("[handleUploadError] Unknown error type:", {
    userId: post.userId,
    postId: post.id,
    platformPostId: platformPost.id,
    errorCode,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });

  await updatePlatformPostStatus(platformPost.id, "FAILED", undefined, errorMessage);

  // Sync post status after marking as FAILED
  await syncPostStatus(platformPost.postId);

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * Update PlatformPost status with optional publishId and errorMessage
 *
 * This function updates a PlatformPost record's status using a database transaction
 * for atomic updates. It can optionally set the publishId (container ID) and
 * errorMessage fields.
 *
 * Requirements: 7.8, 8.6
 *
 * @param platformPostId - The ID of the PlatformPost to update
 * @param status - The new status
 * @param publishId - Optional container ID to store
 * @param errorMessage - Optional error message to store
 * @returns Promise<void>
 */
async function updatePlatformPostStatus(
  platformPostId: string,
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED",
  publishId?: string,
  errorMessage?: string,
): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic update
    // Requirement: 8.6
    await prisma.$transaction(async (tx) => {
      const updateData: {
        status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
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
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 *
 * @param postId - The ID of the Post to sync
 * @returns Promise<void>
 */
async function syncPostStatus(postId: string): Promise<void> {
  const prisma = getPrisma();

  try {
    // Use transaction for atomic update
    // Requirement: 8.6
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
      let newPostStatus:
        | "SCHEDULED"
        | "PUBLISHING"
        | "PUBLISHED"
        | "PARTIALLY_PUBLISHED"
        | "FAILED";

      // Requirement 8.4: Any PUBLISHING → PUBLISHING
      if (statusCounts.PUBLISHING > 0) {
        newPostStatus = "PUBLISHING";
      }
      // Requirement 8.1: All PUBLISHED → PUBLISHED
      else if (statusCounts.PUBLISHED === platformPosts.length) {
        newPostStatus = "PUBLISHED";
      }
      // Requirement 8.3: All FAILED → FAILED
      else if (statusCounts.FAILED === platformPosts.length) {
        newPostStatus = "FAILED";
      }
      // Requirement 8.2: Mix of PUBLISHED and FAILED → PARTIALLY_PUBLISHED
      else if (statusCounts.PUBLISHED > 0 && statusCounts.FAILED > 0) {
        newPostStatus = "PARTIALLY_PUBLISHED";
      }
      // Default: keep as SCHEDULED if still pending
      else {
        newPostStatus = "SCHEDULED";
      }

      // Requirement 8.5: Update Post.updatedAt timestamp when status changes
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
