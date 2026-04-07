import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { b2Client } from "@/lib/b2Client";

/**
 * Video Deletion API Route
 * 
 * Handles video file deletion from Backblaze B2 storage.
 * Accepts DELETE requests with fileKey in the request body,
 * removes the file from B2 bucket using DeleteObjectCommand.
 */

export async function DELETE(request: NextRequest) {
  try {
    // Extract fileKey from request body
    const body = await request.json();
    const { fileKey } = body;

    // Validate fileKey exists and is a string
    if (!fileKey || typeof fileKey !== "string") {
      return NextResponse.json(
        { error: "No fileKey provided" },
        { status: 400 }
      );
    }

    // Validate fileKey is not empty or whitespace-only
    if (fileKey.trim() === "") {
      return NextResponse.json(
        { error: "Invalid fileKey format" },
        { status: 400 }
      );
    }

    // Get bucket ID from environment
    const bucketId = process.env.B2_BUCKET_ID;
    if (!bucketId) {
      return NextResponse.json(
        { error: "B2 bucket configuration missing" },
        { status: 500 }
      );
    }

    // Delete file from B2 bucket using DeleteObjectCommand
    const command = new DeleteObjectCommand({
      Bucket: bucketId,
      Key: fileKey,
    });

    await b2Client.send(command);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "File deleted successfully",
        fileKey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
