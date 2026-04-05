import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { b2Client } from "@/lib/b2Client";

/**
 * File Upload API Route
 * 
 * Handles video and image file uploads to Backblaze B2 storage.
 * Accepts multipart/form-data with a file and optional type parameter,
 * validates the file type and size, generates a unique file key,
 * and uploads to B2 bucket.
 */

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Maximum file size for images (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Extract file and type from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "video"; // Default to "video" for backward compatibility

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Get userId from session headers (injected by middleware)
    const userId = request.headers.get("x-session-sub");

    // Validate file type based on upload type
    if (type === "image") {
      // Validate image file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Only image files are allowed." },
          { status: 400 }
        );
      }

      // Validate image file size (max 5MB)
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: "Image must be smaller than 5MB" },
          { status: 400 }
        );
      }
    } else if (type === "video") {
      // Validate video file type
      if (!file.type.startsWith("video/")) {
        return NextResponse.json(
          { error: "Invalid file type. Only video files are allowed." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'video' or 'image'." },
        { status: 400 }
      );
    }

    // Generate unique file key with timestamp and sanitized filename
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    // Generate file key based on type
    let fileKey: string;
    if (type === "image" && userId) {
      // For images, use profile-pictures/{userId}/{timestamp}-{sanitizedFileName}
      fileKey = `profile-pictures/${userId}/${timestamp}-${sanitizedFilename}`;
    } else {
      // For videos or when userId is not available, use uploads/{timestamp}-{sanitizedFileName}
      fileKey = `uploads/${timestamp}-${sanitizedFilename}`;
    }

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
