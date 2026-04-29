import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";

// Increase max duration for file uploads (60 seconds)
export const maxDuration = 60;

export async function POST(request: Request) {
  // Authenticate the user
  const authCheck = await ensureAuth();
  if (authCheck instanceof NextResponse) return authCheck;
  const user = authCheck;

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const fileType = formData.get('fileType') as string;

    if (!file || !fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing file or metadata" },
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
    if (file.size > 262144000) {
      return NextResponse.json(
        { error: "File size exceeds 250MB limit" },
        { status: 400 }
      );
    }

    // Step 1: Authorize with B2 API
    const authResponse = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_authorize_account`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.B2_ACCOUNT_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64')}`
      }
    });

    if (!authResponse.ok) {
      console.error("B2 authorization failed:", await authResponse.text());
      return NextResponse.json(
        { error: "Failed to authorize with storage provider" },
        { status: 500 }
      );
    }

    const authData = await authResponse.json();
    const { authorizationToken, apiUrl } = authData;

    // Step 2: Get upload URL from B2
    const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        'Authorization': authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: process.env.B2_BUCKET_ID
      })
    });

    if (!uploadUrlResponse.ok) {
      console.error("Failed to get upload URL:", await uploadUrlResponse.text());
      return NextResponse.json(
        { error: "Failed to generate upload URL" },
        { status: 500 }
      );
    }

    const uploadData = await uploadUrlResponse.json();

    // Step 3: Upload file to B2
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const timestamp = Date.now();
    const fileKey = `uploads/${user.id}/${timestamp}-${sanitizedFileName}`;

    const fileBuffer = await file.arrayBuffer();
    
    const uploadResponse = await fetch(uploadData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadData.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(fileKey),
        'Content-Type': fileType,
        'Content-Length': file.size.toString(),
        'X-Bz-Content-Sha1': 'do_not_verify',
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("B2 upload failed:", errorText);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const uploadResult = await uploadResponse.json();

    console.log("File uploaded successfully to B2:", {
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      fileKey
    });

    // Return success response
    return NextResponse.json({
      success: true,
      fileKey,
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
