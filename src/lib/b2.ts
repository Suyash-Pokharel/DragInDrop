/**
 * Backblaze B2 — S3-compatible client helper.
 *
 * Uses the AWS SDK v3 pointed at the B2 regional endpoint.
 * Generates presigned PUT URLs so browsers upload directly to B2
 * (no server-side streaming bottleneck).
 *
 * Required env vars:
 *   B2_ACCOUNT_ID   — Backblaze Account ID (used as AWS access key)
 *   B2_APP_KEY      — Backblaze Application Key (used as AWS secret key)
 *   B2_BUCKET_ID    — Backblaze Bucket ID (used as bucket name for S3 API)
 *   B2_ENDPOINT     — e.g. https://s3.eu-central-003.backblazeb2.com
 *   NEXT_PUBLIC_APP_URL — used to build CORS-compatible public CDN URLs
 *
 * IMPORTANT — B2 CORS config:
 *   Your B2 bucket must have a CORS rule allowing PUT from your app origins.
 *   In the Backblaze dashboard: Bucket → CORS Rules → Add Rule:
 *     Allowed Origins: https://your-domain.vercel.app, http://localhost:3000
 *     Allowed Operations: s3_put
 *     Allowed Headers: *
 *     Max Age Seconds: 3600
 */
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getB2Client(): S3Client {
  const endpoint = process.env.B2_ENDPOINT;
  const accountId = process.env.B2_ACCOUNT_ID;
  const appKey = process.env.B2_APP_KEY;

  if (!endpoint || !accountId || !appKey) {
    throw new Error(
      "Missing Backblaze B2 environment variables: B2_ENDPOINT, B2_ACCOUNT_ID, B2_APP_KEY",
    );
  }

  return new S3Client({
    endpoint,
    region: "auto",
    credentials: {
      accessKeyId: accountId,
      secretAccessKey: appKey,
    },
    // Required for B2's S3-compatible API path-style addressing
    forcePathStyle: true,
  });
}

function getBucketId(): string {
  const id = process.env.B2_BUCKET_ID;
  if (!id) throw new Error("Missing B2_BUCKET_ID environment variable.");
  return id;
}

export interface PresignResult {
  /** PUT this URL directly from the browser. */
  uploadUrl: string;
  /** The publicly accessible URL of the stored file. */
  publicUrl: string;
  /** The object key stored in B2 (save this in your DB). */
  key: string;
}

/**
 * Generates a short-lived (15-min) presigned PUT URL for a direct browser upload.
 *
 * @param key         - Object key within the bucket, e.g. "uploads/userId/uuid.mp4"
 * @param contentType - MIME type, e.g. "video/mp4"
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900, // 15 minutes
): Promise<PresignResult> {
  const client = getB2Client();
  const bucket = getBucketId();
  const endpoint = process.env.B2_ENDPOINT!;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  // B2 S3-compatible public URL format
  const publicUrl = `${endpoint}/file/${bucket}/${key}`;

  return { uploadUrl, publicUrl, key };
}
