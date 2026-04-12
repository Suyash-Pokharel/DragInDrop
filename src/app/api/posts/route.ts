import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

/**
 * Zod schema for post creation request validation
 * Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12
 */
const createPostSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .max(250, "Description must not exceed 250 characters")
    .optional(),
  scheduledFor: z
    .string({ message: "Scheduled time is required" })
    .refine(
      (dateStr) => {
        const scheduledDate = new Date(dateStr);
        return scheduledDate > new Date();
      },
      { message: "Scheduled time must be in the future" }
    ),
  videoFileKey: z
    .string({ message: "Video file key is required" })
    .min(1, "Video file key is required"),
  videoFileName: z
    .string({ message: "Video file name is required" })
    .min(1, "Video file name is required"),
  videoFileSize: z
    .number({ message: "Video file size is required" })
    .positive("Video file size must be positive"),
  selectedPlatforms: z
    .array(z.string(), { message: "At least one platform must be selected" })
    .min(1, "At least one platform must be selected"),
});

/**
 * POST /api/posts
 * Creates a new post with platform associations
 * Requirements: 2.1, 2.6
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  // Requirement: 2.6 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[POST /api/posts] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    // Requirements: 2.7-2.12 - Handle validation errors (400)
    const validationResult = createPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      console.error("[POST /api/posts] Validation error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: firstError.message,
        field: firstError.path.join("."),
        receivedValue: firstError.path.length > 0 ? body[firstError.path[0]] : undefined,
      });
      
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      scheduledFor,
      videoFileKey,
      videoFileName,
      videoFileSize,
      selectedPlatforms,
    } = validationResult.data;

    const prisma = getPrisma();

    // Query SocialAccount records for user and selected platforms
    // Requirements: 2.2, 2.3
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        platform: { in: selectedPlatforms },
        isActive: true,
      },
    });

    // Validate all platforms have corresponding SocialAccount records
    // Requirement: 4.7, 5.8, 11.1, 11.4 - Handle missing SocialAccount errors (400)
    const foundPlatforms = socialAccounts.map((sa) => sa.platform);
    const missingPlatforms = selectedPlatforms.filter(
      (platform) => !foundPlatforms.includes(platform)
    );

    if (missingPlatforms.length > 0) {
      console.error("[POST /api/posts] Missing SocialAccount error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Invalid platform selection",
        missingPlatforms,
        selectedPlatforms,
        foundPlatforms,
      });
      
      // Provide specific error message for single platform (Requirement 11.4)
      const errorMessage = missingPlatforms.length === 1
        ? `${missingPlatforms[0]} account not connected`
        : `Invalid platform selection: ${missingPlatforms.join(", ")}`;
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Create a map of platform to socialAccountId for easy lookup
    const platformToAccountMap = new Map(
      socialAccounts.map((sa) => [sa.platform, sa.id])
    );

    // Use Prisma transaction to ensure atomicity
    // Requirements: 2.3, 2.4, 2.5, 4.8
    const result = await prisma.$transaction(async (tx) => {
      // Create Post record with status SCHEDULED
      const post = await tx.post.create({
        data: {
          userId: user.id,
          title,
          description: description || null,
          videoFileKey,
          videoFileName,
          videoFileSize,
          scheduledFor: new Date(scheduledFor),
          status: "SCHEDULED",
        },
      });

      // Create PlatformPost records with status PENDING for each platform
      const platformPosts = await Promise.all(
        selectedPlatforms.map((platform) =>
          tx.platformPost.create({
            data: {
              postId: post.id,
              socialAccountId: platformToAccountMap.get(platform)!,
              status: "PENDING",
            },
          })
        )
      );

      return { post, platformPosts };
    });

    // Log successful post creation
    console.log("[POST /api/posts] Post created successfully:", {
      userId: user.id,
      postId: result.post.id,
      timestamp: new Date().toISOString(),
      platformCount: result.platformPosts.length,
      platforms: selectedPlatforms,
    });

    // Return 201 with postId on success
    return NextResponse.json(
      { success: true, postId: result.post.id, message: "Post created successfully" },
      { status: 201 }
    );
  } catch (error) {
    // Requirement: 2.13, 5.6 - Handle database errors (500) and log with user context
    console.error("[POST /api/posts] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
