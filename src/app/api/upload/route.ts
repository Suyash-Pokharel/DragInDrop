import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { b2Client } from "@/lib/b2Client";

/**
 * Video Upload API Route
 * 
 * Handles video file uploads to Backblaze B2 storage.
 * Accepts multipart/form-data with a video file, validates the file type,
 * generates a unique file key, and uploads to B2 bucket.
 */

export async function POST(request: NextRequest) {
  try {
    // Extract file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (video/*)
    if (!file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only video files are allowed." },
        { status: 400 }
      );
    }

    // Generate unique file key with timestamp and original filename
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileKey = `uploads/${timestamp}-${sanitizedFilename}`;

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get bucket ID from environment
    const bucketId = process.env.B2_BUCKET_ID;
    if (!bucketId) {
      return NextResponse.json(
        { error: "B2 bucket configuration missing" },
        { status: 500 }
      );
    }

    // Upload file to B2 bucket using PutObjectCommand
    const command = new PutObjectCommand({
      Bucket: bucketId,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
    });

    await b2Client.send(command);

    // Construct file URL
    const endpoint = process.env.B2_ENDPOINT_URL;
    const fileUrl = `https://${endpoint}/file/${bucketId}/${fileKey}`;

    // Return success response with file URL and key
    return NextResponse.json(
      {
        success: true,
        fileUrl,
        fileKey,
        message: "File uploaded successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
