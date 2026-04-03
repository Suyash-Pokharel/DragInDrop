import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";

/**
 * Video Upload Record API Route
 * 
 * Creates a VideoUpload database record for a file that was uploaded to B2.
 * This links the uploaded file to the user and allows it to be associated with scheduled posts.
 */

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json(
        { error: "Missing required field: fileKey" },
        { status: 400 }
      );
    }

    // Construct file URL from fileKey
    const endpoint = process.env.B2_ENDPOINT_URL;
    const bucketId = process.env.B2_BUCKET_ID;
    
    if (!endpoint || !bucketId) {
      return NextResponse.json(
        { error: "B2 configuration missing" },
        { status: 500 }
      );
    }

    const fileUrl = `https://${endpoint}/file/${bucketId}/${fileKey}`;

    // Create VideoUpload record
    const prisma = getPrisma();
    const videoUpload = await prisma.videoUpload.create({
      data: {
        userId: user.id,
        fileKey,
        fileUrl,
      },
    });

    return NextResponse.json(
      {
        success: true,
        videoUploadId: videoUpload.id,
        message: "Video upload record created successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating video upload record:", error);
    return NextResponse.json(
      {
        error: "Failed to create video upload record",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
