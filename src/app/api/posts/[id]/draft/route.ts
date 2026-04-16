import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

/**
 * PUT /api/posts/[id]/draft
 * Converts a scheduled post back to draft status by updating the Post status to DRAFT
 * and deleting all associated PlatformPost records while preserving the video file
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Authenticate user
  // Requirement: 6.7 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[PUT /api/posts/[id]/draft] Authentication failed:", {
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
        status: true,
        title: true,
        videoFileKey: true,
      },
    });

    // Handle post not found
    // Requirement: 6.9 - Handle 404 error cases
    if (!existingPost) {
      console.error("[PUT /api/posts/[id]/draft] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });
      
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Check authorization - user must own the post
    // Requirement: 6.8 - Handle authorization errors (403)
    if (existingPost.userId !== user.id) {
      console.error("[PUT /api/posts/[id]/draft] Authorization failed:", {
        userId: user.id,
        postOwnerId: existingPost.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });
      
      return NextResponse.json(
        { error: "You do not have permission to edit this post" },
        { status: 403 }
      );
    }

    // Use database transaction for atomicity
    // Requirements: 6.5, 6.2, 6.3 - Use transaction to update Post status and delete PlatformPost records
    const result = await prisma.$transaction(async (tx) => {
      // Update the Post status to DRAFT
      // Requirement: 6.2 - Update Post status to DRAFT
      const updatedPost = await tx.post.update({
        where: { id },
        data: {
          status: 'DRAFT',
          updatedAt: new Date(),
        },
      });

      // Delete all associated PlatformPost records
      // Requirement: 6.3 - Delete all associated PlatformPost records
      await tx.platformPost.deleteMany({
        where: {
          postId: id,
        },
      });

      return updatedPost;
    });

    // Log successful conversion
    // Note: Video file is preserved in B2 storage as per Requirement: 6.4
    console.log("[PUT /api/posts/[id]/draft] Post converted to draft successfully:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      title: existingPost.title,
      videoFileKey: existingPost.videoFileKey,
      previousStatus: existingPost.status,
      newStatus: result.status,
      videoFilePreserved: true,
    });

    // Requirement: 6.6 - Return success response
    return NextResponse.json(
      { message: "Post saved as draft successfully" },
      { status: 200 }
    );

  } catch (error) {
    // Requirement: 6.10 - Handle database errors (500) with proper logging
    console.error("[PUT /api/posts/[id]/draft] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to convert post to draft" },
      { status: 500 }
    );
  }
}