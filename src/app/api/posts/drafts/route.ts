import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

/**
 * Zod schema for draft creation request validation
 * Requirements: 2.4, 2.5, 2.6, 3.1, 3.2
 */
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

/**
 * POST /api/posts/drafts
 * Creates a new draft post with minimal validation requirements
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  // Requirement: 2.2, 2.3 - Handle authentication errors (401)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[POST /api/posts/drafts] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    // Requirements: 2.4, 2.5, 2.6, 2.7 - Handle validation errors (400)
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

    // Create Post record with status DRAFT
    // Requirements: 2.8, 2.9, 3.3, 3.4, 3.5, 9.1, 9.2, 9.3, 9.4
    const draft = await prisma.post.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        title,
        description: description || null,
        videoFileKey,
        videoFileName,
        videoFileSize,
        // Use sentinel value for scheduledFor since schema requires DateTime
        scheduledFor: new Date('2099-12-31T23:59:59Z'),
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log successful draft creation
    console.log("[POST /api/posts/drafts] Draft created successfully:", {
      userId: user.id,
      draftId: draft.id,
      timestamp: new Date().toISOString(),
    });

    // Return 201 with draftId on success
    // Requirement: 2.9
    return NextResponse.json(
      { success: true, draftId: draft.id, message: "Draft saved successfully" },
      { status: 201 }
    );
  } catch (error) {
    // Requirement: 2.10, 9.5 - Handle database errors (500) and log with user context
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
