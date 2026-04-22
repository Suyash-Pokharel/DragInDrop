import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
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

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: {
          status: 'DRAFT',
          updatedAt: new Date(),
        },
      });

      await tx.platformPost.deleteMany({
        where: {
          postId: id,
        },
      });

      return updatedPost;
    });

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

    return NextResponse.json(
      { message: "Post saved as draft successfully" },
      { status: 200 }
    );

  } catch (error) {
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