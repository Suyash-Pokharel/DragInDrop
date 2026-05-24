/**
 * TikTok API Integration Module
 *
 * This module encapsulates all TikTok API interactions for video uploads and status polling
 * using TikTok's Content Posting API v2 with the PULL_FROM_URL method.
 *
 */

/**
 * Parameters for uploading a video to TikTok
 */
export interface UploadVideoParams {
  accessToken: string;
  videoUrl: string; // Signed URL with authorization token
  title: string;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

/**
 * Response from uploading a video to TikTok
 */
export interface UploadVideoResponse {
  success: boolean;
  publishId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parameters for polling upload status
 */
export interface PollStatusParams {
  accessToken: string;
  publishId: string;
}

/**
 * Response from polling upload status
 */
export interface PollStatusResponse {
  success: boolean;
  status?: "PROCESSING_DOWNLOAD" | "PROCESSING_UPLOAD" | "PUBLISH_COMPLETE" | "FAILED";
  publiclyAvailablePostIds?: string[]; // TikTok post IDs when published
  error?: string;
  errorCode?: string;
  failReason?: string;
}

/**
 * TikTok API response for video upload
 */
export interface TikTokUploadResponse {
  data?: {
    publish_id: string;
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

/**
 * TikTok API response for status polling
 */
export interface TikTokStatusResponse {
  data?: {
    status: string;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

/**
 * Upload a video to TikTok using PULL_FROM_URL method
 *
 * This function initiates a video upload to TikTok by providing a URL where TikTok
 * can download the video. The URL should be a signed Backblaze URL with authorization token.
 *
 * @param {UploadVideoParams} params - Upload parameters including access token, video URL, and post settings
 * @returns {Promise<UploadVideoResponse>} Upload result with publish_id or error details
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns error
 * - HTTP 401/403: Token expired → Returns auth error
 * - HTTP 429: Rate limit exceeded → Returns rate limit error
 * - HTTP 5xx: Server error → Returns server error
 * - Network timeout: 30-second timeout → Returns timeout error
 *
 * @example
 * const result = await uploadVideo({
 *   accessToken: 'act.abc123...',
 *   videoUrl: 'https://s3.eu-central-003.backblazeb2.com/file/bucket/video.mp4?Authorization=...',
 *   title: 'My Video Title',
 *   privacyLevel: 'PUBLIC_TO_EVERYONE'
 * });
 */
export async function uploadVideo(params: UploadVideoParams): Promise<UploadVideoResponse> {
  const {
    accessToken,
    videoUrl,
    title,
    privacyLevel = "PUBLIC_TO_EVERYONE",
    disableComment = false,
    disableDuet = false,
    disableStitch = false,
  } = params;

  try {
    // Create abort controller for 30-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_comment: disableComment,
          disable_duet: disableDuet,
          disable_stitch: disableStitch,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: TikTokUploadResponse = await response.json();

    // Handle HTTP error codes
    if (!response.ok) {
      // HTTP 400: Invalid request
      if (response.status === 400) {
        return {
          success: false,
          error: data.error?.message || "Invalid request parameters",
          errorCode: data.error?.code || "bad_request",
        };
      }

      // HTTP 401/403: Authentication error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error?.message || "Authentication failed",
          errorCode: data.error?.code || "auth_error",
        };
      }

      // HTTP 429: Rate limit exceeded
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
          errorCode: "rate_limit",
        };
      }

      // HTTP 5xx: Server error
      if (response.status >= 500) {
        return {
          success: false,
          error: data.error?.message || "TikTok server error",
          errorCode: data.error?.code || "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: data.error?.code || "unknown_error",
      };
    }

    // Extract publish_id from successful response
    //
    if (!data.data?.publish_id) {
      return {
        success: false,
        error: "No publish_id in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      publishId: data.data.publish_id,
    };
  } catch (error) {
    // Handle timeout and network errors
    //
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout after 30 seconds",
          errorCode: "timeout",
        };
      }

      return {
        success: false,
        error: error.message,
        errorCode: "network_error",
      };
    }

    return {
      success: false,
      error: "Unknown error occurred",
      errorCode: "unknown_error",
    };
  }
}

/**
 * Poll the status of a TikTok video upload
 *
 * This function checks the current status of a video upload using the publish_id
 * returned from the upload initiation.
 *
 * @param {PollStatusParams} params - Parameters including access token and publish_id
 * @returns {Promise<PollStatusResponse>} Status result with current upload status or error details
 *
 * Status Values:
 * - PROCESSING_DOWNLOAD: TikTok is downloading video from URL
 * - PROCESSING_UPLOAD: TikTok is processing the video
 * - PUBLISH_COMPLETE: Video published successfully
 * - FAILED: Upload or processing failed
 *
 * @example
 * const result = await pollStatus({
 *   accessToken: 'act.abc123...',
 *   publishId: 'v_pub_1234567890'
 * });
 */
export async function pollStatus(params: PollStatusParams): Promise<PollStatusResponse> {
  const { accessToken, publishId } = params;

  try {
    // Create abort controller for 30-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: TikTokStatusResponse = await response.json();

    // Handle HTTP error codes
    if (!response.ok) {
      // HTTP 400: Invalid request
      if (response.status === 400) {
        return {
          success: false,
          error: data.error?.message || "Invalid request parameters",
          errorCode: data.error?.code || "bad_request",
        };
      }

      // HTTP 401/403: Authentication error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error?.message || "Authentication failed",
          errorCode: data.error?.code || "auth_error",
        };
      }

      // HTTP 429: Rate limit exceeded
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
          errorCode: "rate_limit",
        };
      }

      // HTTP 5xx: Server error
      if (response.status >= 500) {
        return {
          success: false,
          error: data.error?.message || "TikTok server error",
          errorCode: data.error?.code || "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: data.error?.code || "unknown_error",
      };
    }

    // Extract status from successful response
    if (!data.data?.status) {
      return {
        success: false,
        error: "No status in response",
        errorCode: "invalid_response",
      };
    }

    const status = data.data.status as PollStatusResponse["status"];

    return {
      success: true,
      status,
      publiclyAvailablePostIds: data.data.publicaly_available_post_id, // Note: TikTok API has typo "publicaly"
      failReason: data.data.fail_reason,
    };
  } catch (error) {
    // Handle timeout and network errors
    //
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout after 30 seconds",
          errorCode: "timeout",
        };
      }

      return {
        success: false,
        error: error.message,
        errorCode: "network_error",
      };
    }

    return {
      success: false,
      error: "Unknown error occurred",
      errorCode: "unknown_error",
    };
  }
}
