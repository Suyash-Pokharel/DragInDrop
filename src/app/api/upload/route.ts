import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getPrisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/session";

// B2 Configuration from your .env.local
const B2_ENDPOINT = process.env.B2_ENDPOINT_URL || ""; // e.g., s3.us-west-004.backblazeb2.com
const B2_ACCOUNT_ID = process.env.B2_ACCOUNT_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

const s3Client = new S3Client({
  endpoint: `https://${B2_ENDPOINT}`,
  region: B2_ENDPOINT.split(".")[1] || "us-east-1", // Extract region or fallback
  credentials: {
    accessKeyId: B2_ACCOUNT_ID!,
    secretAccessKey: B2_APP_KEY!,
  },
  forcePathStyle: true,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate User
    const cookie = req.cookies.get("session")?.value;
    if (!cookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifySignedToken(cookie);
    if (!payload || !payload.sub) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const userId = payload.sub;

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `uploads/${userId}/${Date.now()}-${file.name}`;

    // 3. Upload to Backblaze B2
    const uploadParams = {
      Bucket: B2_BUCKET_ID,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const fileUrl = `https://${B2_BUCKET_ID}.${B2_ENDPOINT}/${fileKey}`;

    // 4. Record in Database
    const prisma = getPrisma();
    const video = await prisma.videoUpload.create({
      data: {
        userId,
        fileName: file.name,
        fileKey: fileKey,
        fileUrl: fileUrl,
        fileSize: file.size,
        status: "uploaded",
      },
    });

    return NextResponse.json({ success: true, video });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
