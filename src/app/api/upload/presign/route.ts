import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verifySignedToken } from "@/lib/session";
import { generatePresignedUploadUrl } from "@/lib/b2";

// Allowed video MIME types
const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
]);

// Maximum file size: 2 GB (enforced on the client, presign still issues URL)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * POST /api/upload/presign
 *
 * Generates a short-lived (15-min) Backblaze B2 presigned PUT URL.
 * The browser uploads the video file directly to B2 — no server buffering.
 *
 * Request body: { filename: string, contentType: string, fileSize: number }
 * Response:     { uploadUrl, publicUrl, key }
 */
export async function POST(req: Request) {
  // Validate session
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifySignedToken(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = payload.sub;

  let body: { filename?: string; contentType?: string; fileSize?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { filename, contentType, fileSize } = body;

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required." },
      { status: 400 },
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported content type. Only video files are allowed." },
      { status: 415 },
    );
  }

  if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 2 GB maximum size limit." },
      { status: 413 },
    );
  }

  // Build a namespaced, collision-free object key
  const ext = filename.split(".").pop()?.toLowerCase() ?? "mp4";
  const uuid = crypto.randomUUID();
  const key = `uploads/${userId}/${uuid}.${ext}`;

  try {
    const result = await generatePresignedUploadUrl(key, contentType);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/presign] Error generating presigned URL:", err);
    return NextResponse.json(
      { error: "Failed to generate upload URL." },
      { status: 500 },
    );
  }
}
