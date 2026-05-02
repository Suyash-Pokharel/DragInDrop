import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

/**
 * Convert a datetime string from a specific timezone to UTC
 * @param dateTimeStr - ISO datetime string representing local time in the user's timezone
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @returns Date object in UTC
 */
function convertToUTC(dateTimeStr: string, timezone: string): Date {
  // Parse the input to extract date/time components
  // Support both formats: with seconds (2026-04-16T09:20:00) and without (2026-04-16T09:20)
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error("Invalid datetime format");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;

  // Create a date string in ISO format with explicit timezone
  const localDateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Create two dates: one in UTC, one formatted in the target timezone
  const utcDate = new Date(`${localDateStr}Z`);

  // Format this UTC date as it would appear in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const partsMap: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      partsMap[part.type] = part.value;
    }
  });

  // The formatted string shows what time it is in the target timezone when it's utcDate in UTC
  const tzYear = parseInt(partsMap.year);
  const tzMonth = parseInt(partsMap.month);
  const tzDay = parseInt(partsMap.day);
  const tzHour = parseInt(partsMap.hour);
  const tzMinute = parseInt(partsMap.minute);
  const tzSecond = parseInt(partsMap.second);

  // Calculate the difference in milliseconds
  const utcMs = utcDate.getTime();
  const tzDateMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
  const offset = utcMs - tzDateMs;

  // Now apply this offset to our target local time
  const targetLocalMs = Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second),
  );
  const targetUtcMs = targetLocalMs + offset;

  return new Date(targetUtcMs);
}

/**
 * Zod schema for post update request validation
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
const updatePostSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .max(250, "Description must not exceed 250 characters")
    .optional()
    .nullable(),
  scheduledFor: z.string({ message: "Scheduled time is required" }).refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Invalid date format"),
  selectedPlatforms: z.array(z.string()).min(1, "At least one platform must be selected"),
  timezone: z.string().optional(),
});

/**
 * GET /api/posts/[id]
 * Retrieves a specific post with associated platform information
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Authenticate user
  // Requirement: 4.4 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const prisma = getPrisma();

    // Fetch post with associated platform posts
    // Requirements: 4.1, 4.2, 4.3
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        PlatformPost: {
          include: {
            SocialAccount: {
              select: {
                platform: true,
              },
            },
          },
        },
      },
    });

    // Handle post not found
    // Requirement: 4.6 - Handle 404 error cases
    if (!post) {
      console.error("[GET /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });

      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check authorization - user must own the post
    // Requirement: 4.5 - Handle authorization errors (403)
    if (post.userId !== user.id) {
      console.error("[GET /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: post.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });

      return NextResponse.json(
        { error: "You do not have permission to access this post" },
        { status: 403 },
      );
    }

    // Extract platform IDs from PlatformPost records
    // Requirement: 4.3 - Return associated platform IDs
    const selectedPlatforms = post.PlatformPost.map(
      (platformPost) => platformPost.SocialAccount.platform,
    );

    // Prepare response data
    // Requirements: 4.2 - Return post data with title, description, scheduledFor, video metadata
    const responseData = {
      id: post.id,
      title: post.title,
      description: post.description,
      scheduledFor: post.scheduledFor.toISOString(),
      status: post.status,
      videoFileKey: post.videoFileKey,
      videoFileName: post.videoFileName,
      videoFileSize: post.videoFileSize,
      selectedPlatforms,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };

    // Log successful retrieval
    console.log("[GET /api/posts/[id]] Post retrieved successfully:", {
      userId: user.id,
      postId: post.id,
      timestamp: new Date().toISOString(),
      platformCount: selectedPlatforms.length,
      platforms: selectedPlatforms,
      status: post.status,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    // Requirement: 4.7 - Handle database errors (500) with proper logging
    console.error("[GET /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to retrieve post" }, { status: 500 });
  }
}

/**
 * PUT /api/posts/[id]
 * Updates a scheduled post with new title, description, scheduledFor, and platform selection
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Authenticate user
  // Requirement: 5.12 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[PUT /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const body = await request.json();

    // Validate request body
    // Requirements: 5.2, 5.3, 5.4, 5.5 - Validate input data
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errors =
        validationResult.error?.issues?.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })) || [];

      console.error("[PUT /api/posts/[id]] Validation failed:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        errors,
      });

      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const { title, description, scheduledFor, selectedPlatforms, timezone } = validationResult.data;

    const prisma = getPrisma();

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        PlatformPost: {
          include: {
            SocialAccount: {
              select: {
                platform: true,
              },
            },
          },
        },
      },
    });

    // Handle post not found
    // Requirement: 5.14 - Handle 404 error cases
    if (!existingPost) {
      console.error("[PUT /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });

      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check authorization - user must own the post
    // Requirement: 5.13 - Handle authorization errors (403)
    if (existingPost.userId !== user.id) {
      console.error("[PUT /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: existingPost.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });

      return NextResponse.json(
        { error: "You do not have permission to edit this post" },
        { status: 403 },
      );
    }

    // Get user preferences for timezone conversion
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
      select: { timezone: true },
    });

    // Convert scheduledFor from user timezone to UTC
    // Requirements: 5.6 - Convert scheduledFor from user timezone to UTC
    // Use timezone from request if provided, otherwise fall back to user preferences
    const userTimezone = timezone || userPreferences?.timezone || "UTC";
    const scheduledForUTC = convertToUTC(scheduledFor, userTimezone);

    // Validate scheduledFor is at least 10 minutes in the future
    // Requirement: 5.4 - Validate scheduledFor is at least 10 minutes in future
    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

    if (scheduledForUTC <= minScheduleTime) {
      console.error("[PUT /api/posts/[id]] Invalid schedule time:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        scheduledFor: scheduledForUTC.toISOString(),
        minScheduleTime: minScheduleTime.toISOString(),
        error: "Schedule must be at least 10 minutes in the future",
      });

      return NextResponse.json(
        { error: "Schedule must be at least 10 minutes in the future" },
        { status: 400 },
      );
    }

    // Get user's social accounts for the selected platforms
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        platform: { in: selectedPlatforms },
        isActive: true,
      },
    });

    // Validate that user has connected accounts for all selected platforms
    const connectedPlatforms = socialAccounts.map((account) => account.platform);
    const missingPlatforms = selectedPlatforms.filter(
      (platform) => !connectedPlatforms.includes(platform),
    );

    if (missingPlatforms.length > 0) {
      console.error("[PUT /api/posts/[id]] Missing platform connections:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        missingPlatforms,
        error: "User does not have connected accounts for selected platforms",
      });

      return NextResponse.json(
        {
          error: "Missing platform connections",
          details: missingPlatforms.map((platform) => ({
            field: "selectedPlatforms",
            message: `${platform} account not connected`,
          })),
        },
        { status: 400 },
      );
    }

    // Use database transaction for atomicity
    // Requirements: 5.10, 5.7, 5.8, 5.9 - Update Post and manage PlatformPost associations
    const result = await prisma.$transaction(async (tx) => {
      // Update the Post record
      // Requirement: 5.7 - Update Post record with new data
      const updatedPost = await tx.post.update({
        where: { id },
        data: {
          title,
          description: description || null,
          scheduledFor: scheduledForUTC,
          updatedAt: new Date(),
        },
      });

      // Get current platform associations
      const currentPlatformPosts = existingPost.PlatformPost;
      const currentPlatforms = currentPlatformPosts.map((pp) => pp.SocialAccount.platform);

      // Determine platforms to add and remove
      const platformsToAdd = selectedPlatforms.filter(
        (platform) => !currentPlatforms.includes(platform),
      );
      const platformsToRemove = currentPlatforms.filter(
        (platform) => !selectedPlatforms.includes(platform),
      );

      // Remove PlatformPost records for deselected platforms
      // Requirement: 5.8 - Delete PlatformPost records for deselected platforms
      if (platformsToRemove.length > 0) {
        const platformPostsToRemove = currentPlatformPosts
          .filter((pp) => platformsToRemove.includes(pp.SocialAccount.platform))
          .map((pp) => pp.id);

        await tx.platformPost.deleteMany({
          where: {
            id: { in: platformPostsToRemove },
          },
        });
      }

      // Create PlatformPost records for newly selected platforms
      // Requirement: 5.9 - Create PlatformPost records for newly selected platforms
      if (platformsToAdd.length > 0) {
        const socialAccountsToAdd = socialAccounts.filter((account) =>
          platformsToAdd.includes(account.platform),
        );

        const platformPostsToCreate = socialAccountsToAdd.map((account) => ({
          id: crypto.randomUUID(),
          postId: id,
          socialAccountId: account.id,
          status: "PENDING" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await tx.platformPost.createMany({
          data: platformPostsToCreate,
        });
      }

      return updatedPost;
    });

    // Log successful update
    console.log("[PUT /api/posts/[id]] Post updated successfully:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      title: result.title,
      scheduledFor: result.scheduledFor.toISOString(),
      platformCount: selectedPlatforms.length,
      platforms: selectedPlatforms,
    });

    // Requirement: 5.11 - Return success response
    return NextResponse.json({ message: "Post updated successfully" }, { status: 200 });
  } catch (error) {
    // Requirement: 5.15 - Handle database errors (500) with proper logging
    console.error("[PUT /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/[id]
 * Deletes a post, its associated platform posts, and the video file from B2 storage
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Authenticate user
  // Requirement: 8.10 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const prisma = getPrisma();

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        videoFileKey: true,
        videoFileName: true,
      },
    });

    // Handle post not found
    // Requirement: 8.12 - Handle 404 error cases
    if (!existingPost) {
      console.error("[DELETE /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });

      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check authorization - user must own the post
    // Requirement: 8.11 - Handle authorization errors (403)
    if (existingPost.userId !== user.id) {
      console.error("[DELETE /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: existingPost.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });

      return NextResponse.json(
        { error: "You do not have permission to delete this post" },
        { status: 403 },
      );
    }

    // Delete from database first (in transaction)
    // Requirements: 8.1, 8.2, 8.4 - Delete Post and PlatformPost records in transaction
    await prisma.$transaction(async (tx) => {
      // Delete all associated PlatformPost records
      // Requirement: 8.1 - Delete all associated PlatformPost records
      await tx.platformPost.deleteMany({
        where: { postId: id },
      });

      // Delete the Post record
      // Requirement: 8.2 - Delete the Post record from the database
      await tx.post.delete({
        where: { id },
      });
    });

    // Delete video file from B2 storage
    // Requirements: 8.3, 8.5, 8.6, 8.7, 8.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
    try {
      // Step 1: Authorize with B2 API
      // Requirements: 8.5, 12.1, 12.2 - Authorize with B2 API using credentials
      const authResponse = await fetch(
        `https://api.backblazeb2.com/b2api/v2/b2_authorize_account`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.B2_ACCOUNT_ID}:${process.env.B2_APPLICATION_KEY}`).toString("base64")}`,
          },
        },
      );

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        // Requirements: 8.8, 12.5 - Log B2 authorization errors but continue
        console.error("[DELETE /api/posts/[id]] B2 authorization failed:", {
          userId: user.id,
          postId: id,
          timestamp: new Date().toISOString(),
          error: errorText,
          videoFileKey: existingPost.videoFileKey,
        });

        // Continue execution - database deletion was successful
      } else {
        const authData = await authResponse.json();
        const { authorizationToken, apiUrl } = authData;

        // Step 2: Get file info to obtain file ID
        // We need the file ID to delete the specific version
        const listResponse = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
          method: "POST",
          headers: {
            Authorization: authorizationToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bucketId: process.env.B2_BUCKET_ID,
            startFileName: existingPost.videoFileKey,
            maxFileCount: 1,
            prefix: existingPost.videoFileKey,
          }),
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          // Requirements: 8.8, 12.6 - Log B2 list files error but continue
          console.error("[DELETE /api/posts/[id]] B2 list files failed:", {
            userId: user.id,
            postId: id,
            timestamp: new Date().toISOString(),
            error: errorText,
            videoFileKey: existingPost.videoFileKey,
          });
        } else {
          const listData = await listResponse.json();

          if (listData.files && listData.files.length > 0) {
            const fileInfo = listData.files[0];

            // Step 3: Delete the file version
            // Requirements: 8.6, 12.3, 12.4 - Call b2_delete_file_version with file ID
            const deleteResponse = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
              method: "POST",
              headers: {
                Authorization: authorizationToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName,
              }),
            });

            if (!deleteResponse.ok) {
              const errorText = await deleteResponse.text();
              // Requirements: 8.8, 12.6 - Log B2 deletion errors but continue
              console.error("[DELETE /api/posts/[id]] B2 file deletion failed:", {
                userId: user.id,
                postId: id,
                timestamp: new Date().toISOString(),
                error: errorText,
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName,
                videoFileKey: existingPost.videoFileKey,
              });
            } else {
              // Log successful B2 file deletion
              console.log("[DELETE /api/posts/[id]] B2 file deleted successfully:", {
                userId: user.id,
                postId: id,
                timestamp: new Date().toISOString(),
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName,
                videoFileKey: existingPost.videoFileKey,
              });
            }
          } else {
            // Requirements: 8.7 - Handle case where file does not exist in B2
            console.warn("[DELETE /api/posts/[id]] File not found in B2 storage:", {
              userId: user.id,
              postId: id,
              timestamp: new Date().toISOString(),
              videoFileKey: existingPost.videoFileKey,
              message: "File may have been already deleted or never uploaded",
            });
          }
        }
      }
    } catch (b2Error) {
      // Requirements: 8.8, 12.5, 12.6 - Log B2 errors but continue execution
      console.error("[DELETE /api/posts/[id]] B2 operation error:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        error: b2Error instanceof Error ? b2Error.message : "Unknown B2 error",
        errorName: b2Error instanceof Error ? b2Error.name : undefined,
        stack: b2Error instanceof Error ? b2Error.stack : undefined,
        videoFileKey: existingPost.videoFileKey,
      });

      // Continue execution - database deletion was successful
    }

    // Log successful post deletion
    console.log("[DELETE /api/posts/[id]] Post deleted successfully:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      title: existingPost.title,
      videoFileKey: existingPost.videoFileKey,
    });

    // Requirement: 8.9 - Return success response
    return NextResponse.json({ message: "Post deleted successfully" }, { status: 200 });
  } catch (error) {
    // Requirement: 8.13 - Handle database errors (500) with proper logging
    console.error("[DELETE /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
