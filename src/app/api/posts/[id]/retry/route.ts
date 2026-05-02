import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";

/**
 * POST /api/posts/[id]/retry
 *
 * Retry a failed post by resetting its status and platform post statuses
 * This allows the cron job to pick it up again for processing
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = id;
    const prisma = getPrisma();

    // Verify the post belongs to the user
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        PlatformPost: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow retry for failed or partially published posts
    if (post.status !== "FAILED" && post.status !== "PARTIALLY_PUBLISHED") {
      return NextResponse.json(
        { error: "Only failed or partially published posts can be retried" },
        { status: 400 },
      );
    }

    // Reset the post status and failed platform posts
    await prisma.$transaction(async (tx) => {
      // Reset Post status to SCHEDULED
      await tx.post.update({
        where: { id: postId },
        data: {
          status: "SCHEDULED",
          updatedAt: new Date(),
        },
      });

      // Reset failed PlatformPost records to PENDING
      await tx.platformPost.updateMany({
        where: {
          postId: postId,
          status: "FAILED",
        },
        data: {
          status: "PENDING",
          errorMessage: null,
          retryCount: 0,
          updatedAt: new Date(),
        },
      });
    });

    console.log("[Retry Post] Post retry initiated:", {
      userId: user.id,
      postId: postId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Post retry initiated successfully",
    });
  } catch (error) {
    console.error("[Retry Post] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
