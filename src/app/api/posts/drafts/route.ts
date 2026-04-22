import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

const draftSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .max(250, "Description must not exceed 250 characters")
    .optional(),
  videoFileKey: z
    .string({ message: "Video file key is required" })
    .min(1, "Video file key is required"),
  videoFileName: z
    .string({ message: "Video file name is required" })
    .min(1, "Video file name is required"),
  videoFileSize: z
    .number({ message: "Video file size is required" })
    .positive("Video file size must be positive"),
});

export async function POST(request: NextRequest) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[POST /api/posts/drafts] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const body = await request.json();

    const validationResult = draftSchema.safeParse(body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      console.error("[POST /api/posts/drafts] Validation error:", {
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
      videoFileKey,
      videoFileName,
      videoFileSize,
    } = validationResult.data;

    const prisma = getPrisma();

    const draft = await prisma.post.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        title,
        description: description || null,
        videoFileKey,
        videoFileName,
        videoFileSize,
        scheduledFor: new Date('2099-12-31T23:59:59Z'),
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("[POST /api/posts/drafts] Draft created successfully:", {
      userId: user.id,
      draftId: draft.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, draftId: draft.id, message: "Draft saved successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/posts/drafts] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    );
  }
}
