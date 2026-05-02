/**
 * Backblaze B2 Signed URL Builder Module
 *
 * This module generates temporary signed URLs for private Backblaze B2 videos,
 * allowing TikTok to download videos securely without making the bucket public.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9
 */

/**
 * Backblaze configuration from environment variables
 */
export interface BackblazeConfig {
  accountId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
  endpoint: string;
}

/**
 * Response from b2_authorize_account API
 */
export interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  recommendedPartSize: number;
  absoluteMinimumPartSize: number;
}

/**
 * Result of signed URL generation
 */
export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

/**
 * Get Backblaze configuration from environment variables
 *
 * @throws {Error} If any required environment variable is missing
 * @returns {BackblazeConfig} Validated Backblaze configuration
 *
 * Requirements: 12.4, 12.5, 12.6, 12.7, 12.8
 */
export function getBackblazeConfig(): BackblazeConfig {
  const accountId = process.env.B2_ACCOUNT_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketId = process.env.B2_BUCKET_ID;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT_URL;

  const missingVars: string[] = [];
  if (!accountId) missingVars.push("B2_ACCOUNT_ID");
  if (!applicationKey) missingVars.push("B2_APPLICATION_KEY");
  if (!bucketId) missingVars.push("B2_BUCKET_ID");
  if (!bucketName) missingVars.push("B2_BUCKET_NAME");
  if (!endpoint) missingVars.push("B2_ENDPOINT_URL");

  if (missingVars.length > 0) {
    throw new Error(`Missing required Backblaze environment variables: ${missingVars.join(", ")}`);
  }

  return {
    accountId: accountId!,
    applicationKey: applicationKey!,
    bucketId: bucketId!,
    bucketName: bucketName!,
    endpoint: endpoint!,
  };
}

/**
 * Authorize with Backblaze B2 API
 *
 * @param {string} accountId - Backblaze account ID
 * @param {string} applicationKey - Backblaze application key
 * @returns {Promise<B2AuthResponse>} Authorization response with token and API URL
 * @throws {Error} If authorization fails
 *
 * Requirements: 13.1
 */
export async function authorizeB2Account(
  accountId: string,
  applicationKey: string,
): Promise<B2AuthResponse> {
  try {
    const authString = Buffer.from(`${accountId}:${applicationKey}`).toString("base64");

    const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`B2 authorization failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      authorizationToken: data.authorizationToken,
      apiUrl: data.apiUrl,
      downloadUrl: data.downloadUrl,
      recommendedPartSize: data.recommendedPartSize,
      absoluteMinimumPartSize: data.absoluteMinimumPartSize,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to authorize with Backblaze B2: ${error.message}`);
    }
    throw new Error("Failed to authorize with Backblaze B2: Unknown error");
  }
}

/**
 * Get download authorization token from Backblaze B2
 *
 * @param {Object} params - Parameters for download authorization
 * @param {string} params.authorizationToken - Authorization token from b2_authorize_account
 * @param {string} params.apiUrl - API URL from b2_authorize_account
 * @param {string} params.bucketId - Bucket ID
 * @param {string} params.fileNamePrefix - File name prefix (the videoFileKey)
 * @param {number} params.validDurationInSeconds - Token validity duration (3600 for 1 hour)
 * @returns {Promise<string>} Download authorization token
 * @throws {Error} If getting download authorization fails
 *
 * Requirements: 13.1, 13.2
 */
export async function getDownloadAuthorization(params: {
  authorizationToken: string;
  apiUrl: string;
  bucketId: string;
  fileNamePrefix: string;
  validDurationInSeconds: number;
}): Promise<string> {
  const { authorizationToken, apiUrl, bucketId, fileNamePrefix, validDurationInSeconds } = params;

  try {
    const response = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: "POST",
      headers: {
        Authorization: authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        fileNamePrefix,
        validDurationInSeconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `B2 get_download_authorization failed with status ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    return data.authorizationToken;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get download authorization from Backblaze B2: ${error.message}`);
    }
    throw new Error("Failed to get download authorization from Backblaze B2: Unknown error");
  }
}

/**
 * Build a video URL using Cloudflare Worker proxy
 *
 * This function generates a URL that points to the Cloudflare Worker,
 * which handles authentication with Backblaze B2 automatically.
 * The Worker fetches from the private bucket and serves the video.
 *
 * @param {string} videoFileKey - The file key/path in the bucket (e.g., "uploads/user123/video.mp4")
 * @returns {Promise<SignedUrlResult>} URL and expiration timestamp
 * @throws {Error} If videoFileKey is empty
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9
 *
 * @example
 * const result = await buildSignedVideoUrl("uploads/user123/video.mp4");
 * console.log(result.signedUrl);
 * // https://upload.suyash-pokharel.com.np/uploads/user123/video.mp4
 */
export async function buildSignedVideoUrl(videoFileKey: string): Promise<SignedUrlResult> {
  // Validate videoFileKey is not empty
  // Requirement: 13.6
  if (!videoFileKey || videoFileKey.trim() === "") {
    throw new Error("videoFileKey cannot be empty");
  }

  // Get Backblaze configuration
  const config = getBackblazeConfig();

  // URL-encode the videoFileKey if it contains special characters
  // Requirement: 13.7
  // We need to encode each path segment separately to preserve forward slashes
  const encodedKey = videoFileKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  // Construct URL using Cloudflare Worker endpoint
  // The Worker handles all B2 authentication automatically
  // Requirements: 13.3, 13.5
  const signedUrl = `https://${config.endpoint}/${encodedKey}`;

  // Cloudflare Worker caches for 1 hour, so we set expiration accordingly
  // Requirement: 13.8
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  return {
    signedUrl,
    expiresAt,
  };
}
