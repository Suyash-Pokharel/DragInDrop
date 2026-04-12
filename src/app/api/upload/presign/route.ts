import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ensureAuth } from "@/lib/ensureAuth";

export async function POST(request: Request) {
  // Authenticate the user
  const authCheck = await ensureAuth();
  if (authCheck instanceof NextResponse) return authCheck;
  const user = authCheck;

  // Parse request body
  const body = await request.json();
  const { fileName, fileType, fileSize } = body;

  // Validate required metadata fields
  if (!fileName || !fileType || fileSize === undefined) {
    return NextResponse.json(
      { error: "Missing file metadata" },
      { status: 400 }
    );
  }

  // Validate file type (video only)
  if (!fileType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only video files are allowed" },
      { status: 400 }
    );
  }

  // Validate file size (max 250MB = 262,144,000 bytes)
  if (fileSize > 262144000) {
    return NextResponse.json(
      { error: "File size exceeds 250MB limit" },
      { status: 400 }
    );
  }

  try {
    // Configure S3 client with B2 endpoint
    const s3Client = new S3Client({
      endpoint: `https://${process.env.B2_ENDPOINT_URL}`,
      region: "eu-central-003",
      credentials: {
        accessKeyId: process.env.B2_ACCOUNT_ID!,
        secretAccessKey: process.env.B2_APP_KEY!,
      },
    });

    // Sanitize fileName: replace non-alphanumeric characters (except dots/hyphens) with underscores
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Generate unique file key: uploads/{userId}/{timestamp}-{sanitizedFileName}
    const timestamp = Date.now();
    const fileKey = `uploads/${user.id}/${timestamp}-${sanitizedFileName}`;

    // Create PutObjectCommand - IMPORTANT: Use bucket NAME, not bucket ID for S3-compatible API
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: fileType,
    });

    // Generate presigned URL with 3600 second (1 hour) expiration
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    console.log("Generated presigned URL for bucket:", process.env.B2_BUCKET_NAME);
    console.log("File key:", fileKey);

    // Return success response
    return NextResponse.json({
      success: true,
      uploadUrl,
      fileKey,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
