import { S3Client } from "@aws-sdk/client-s3";

/**
 * B2 Storage Client Factory
 * 
 * Creates and exports a singleton S3Client configured for Backblaze B2 storage.
 * Uses S3-compatible API with B2-specific endpoint and credentials.
 */

// Read B2 credentials from environment variables
const B2_ENDPOINT_URL = process.env.B2_ENDPOINT_URL;
const B2_ACCOUNT_ID = process.env.B2_ACCOUNT_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;

// Validate required environment variables
if (!B2_ENDPOINT_URL || !B2_ACCOUNT_ID || !B2_APP_KEY) {
  throw new Error(
    "Missing required B2 environment variables: B2_ENDPOINT_URL, B2_ACCOUNT_ID, B2_APP_KEY"
  );
}

/**
 * Singleton S3Client instance configured for Backblaze B2
 * 
 * Configuration:
 * - endpoint: B2 S3-compatible endpoint URL
 * - credentials: B2 account ID (access key) and application key (secret key)
 * - region: us-west-000 (standard B2 region)
 * - forcePathStyle: true (required for B2 compatibility)
 */
export const b2Client = new S3Client({
  endpoint: `https://${B2_ENDPOINT_URL}`,
  region: "us-west-000",
  credentials: {
    accessKeyId: B2_ACCOUNT_ID,
    secretAccessKey: B2_APP_KEY,
  },
  forcePathStyle: true, // Required for B2 compatibility
});
