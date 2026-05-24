/**
 * Instagram API Integration Module
 *
 * This module encapsulates all Instagram API interactions for video uploads using
 * Instagram's container-based publishing system. Videos are published as Reels.
 */

/**
 * Parameters for creating a media container
 */
export interface CreateContainerParams {
  accessToken: string;
  igUserId: string; // Instagram Business or Creator account ID
  videoUrl: string; // Signed URL with authorization token
  caption: string; // Combined title and description (max 2200 chars)
  shareToFeed?: boolean; // Default true - share Reel to feed
}

/**
 * Response from creating a media container
 */
export interface CreateContainerResponse {
  success: boolean;
  containerId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parameters for polling container status
 */
export interface PollContainerStatusParams {
  accessToken: string;
  containerId: string;
}

/**
 * Response from polling container status
 */
export interface PollContainerStatusResponse {
  success: boolean;
  statusCode?: "IN_PROGRESS" | "FINISHED" | "ERROR";
  error?: string;
  errorCode?: string;
  errorMessage?: string; // Instagram's error message if status is ERROR
}

/**
 * Parameters for publishing a container
 */
export interface PublishContainerParams {
  accessToken: string;
  igUserId: string;
  containerId: string;
}

/**
 * Response from publishing a container
 */
export interface PublishContainerResponse {
  success: boolean;
  mediaId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Instagram API response for container creation
 */
interface InstagramContainerResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Instagram API response for container status
 */
interface InstagramStatusResponse {
  status_code?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Instagram API response for container publish
 */
interface InstagramPublishResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Create a media container for video upload
 *
 * This function initiates a video upload to Instagram by creating a media container.
 * Instagram downloads and processes the video from the provided URL.
 *
 * @param {CreateContainerParams} params - Container creation parameters
 * @returns {Promise<CreateContainerResponse>} Container creation result with container ID or error
 *
 *.5, 6.7, 6.8, 6.9
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 30-second timeout → Returns timeout error
 *
 * @example
 * const result = await createMediaContainer({
 *   accessToken: 'IGQWRPabc123...',
 *   igUserId: '17841400000000000',
 *   videoUrl: 'https://s3.eu-central-003.backblazeb2.com/file/bucket/video.mp4?Authorization=...',
 *   caption: 'My Video Title\n\nMy video description',
 *   shareToFeed: true
 * });
 */
export async function createMediaContainer(
  params: CreateContainerParams,
): Promise<CreateContainerResponse> {
  const { accessToken, igUserId, videoUrl, caption, shareToFeed = true } = params;

  try {
    // Create abort controller for 30-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Construct the API URL
    const url = new URL(`https://graph.instagram.com/v21.0/${igUserId}/media`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption: caption,
        share_to_feed: shareToFeed,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: InstagramContainerResponse = await response.json();

    // Handle HTTP error codes
    if (!response.ok) {
      // HTTP 400: Invalid request
      if (response.status === 400) {
        return {
          success: false,
          error: data.error?.message || "Invalid request parameters",
          errorCode: "bad_request",
        };
      }

      // HTTP 401/403: Authentication error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error?.message || "Authentication failed",
          errorCode: "auth_error",
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
          error: data.error?.message || "Instagram server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "unknown_error",
      };
    }

    // Extract container ID from successful response
    //
    if (!data.id) {
      return {
        success: false,
        error: "No container ID in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      containerId: data.id,
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
 * Poll the status of a media container
 *
 * This function checks the current processing status of a media container.
 * Instagram processes videos asynchronously, typically taking 30 seconds to 5 minutes.
 *
 * @param {PollContainerStatusParams} params - Parameters including access token and container ID
 * @returns {Promise<PollContainerStatusResponse>} Status result with current processing status
 *
 * Status Values:
 * - IN_PROGRESS: Instagram is still processing the video
 * - FINISHED: Video processing complete, ready to publish
 * - ERROR: Processing failed
 *
 * @example
 * const result = await pollContainerStatus({
 *   accessToken: 'IGQWRPabc123...',
 *   containerId: '17895695668004550'
 * });
 */
export async function pollContainerStatus(
  params: PollContainerStatusParams,
): Promise<PollContainerStatusResponse> {
  const { accessToken, containerId } = params;

  try {
    // Create abort controller for 10-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL
    const url = new URL(`https://graph.instagram.com/v21.0/${containerId}`);
    url.searchParams.append("fields", "status_code");
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: InstagramStatusResponse = await response.json();

    // Handle HTTP error codes
    //.8, 6.9
    if (!response.ok) {
      // HTTP 400: Invalid request
      if (response.status === 400) {
        return {
          success: false,
          error: data.error?.message || "Invalid request parameters",
          errorCode: "bad_request",
        };
      }

      // HTTP 401/403: Authentication error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error?.message || "Authentication failed",
          errorCode: "auth_error",
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
          error: data.error?.message || "Instagram server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "unknown_error",
      };
    }

    // Extract status from successful response
    if (!data.status_code) {
      return {
        success: false,
        error: "No status_code in response",
        errorCode: "invalid_response",
      };
    }

    const statusCode = data.status_code as PollContainerStatusResponse["statusCode"];

    // If status is ERROR, include the error message
    if (statusCode === "ERROR") {
      return {
        success: true,
        statusCode,
        errorMessage: data.error?.message || "Container processing failed",
      };
    }

    return {
      success: true,
      statusCode,
    };
  } catch (error) {
    // Handle timeout and network errors
    //
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout after 10 seconds",
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
 * Publish a media container to make it live on Instagram
 *
 * This function publishes a processed media container as a Reel on Instagram.
 * The container must have status_code "FINISHED" before publishing.
 *
 * @param {PublishContainerParams} params - Parameters including access token, user ID, and container ID
 * @returns {Promise<PublishContainerResponse>} Publish result with media ID or error
 *
 *
 * @example
 * const result = await publishContainer({
 *   accessToken: 'IGQWRPabc123...',
 *   igUserId: '17841400000000000',
 *   containerId: '17895695668004550'
 * });
 */
export async function publishContainer(
  params: PublishContainerParams,
): Promise<PublishContainerResponse> {
  const { accessToken, igUserId, containerId } = params;

  try {
    // Create abort controller for 30-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Construct the API URL
    const url = new URL(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creation_id: containerId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: InstagramPublishResponse = await response.json();

    // Handle HTTP error codes
    if (!response.ok) {
      // HTTP 400: Invalid request
      if (response.status === 400) {
        return {
          success: false,
          error: data.error?.message || "Invalid request parameters",
          errorCode: "bad_request",
        };
      }

      // HTTP 401/403: Authentication error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error?.message || "Authentication failed",
          errorCode: "auth_error",
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
          error: data.error?.message || "Instagram server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "unknown_error",
      };
    }

    // Extract media ID from successful response
    //
    if (!data.id) {
      return {
        success: false,
        error: "No media ID in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      mediaId: data.id,
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
