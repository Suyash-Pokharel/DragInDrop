/**
 * Threads API Integration Module
 *
 * This module encapsulates all Threads API interactions for video uploads using
 * Threads' container-based publishing system (similar to Instagram).
 */

/**
 * Parameters for creating a media container
 */
export interface CreateContainerParams {
  accessToken: string;
  threadsUserId: string; // Threads user ID
  videoUrl: string; // Signed URL with authorization token
  text: string; // Caption (max 500 chars)
}

/**
 * Response from creating a media container
 */
export interface CreateContainerResponse {
  success: boolean;
  containerId?: string;
  error?: string;
  errorCode?:
    | "bad_request"
    | "auth_error"
    | "rate_limit"
    | "server_error"
    | "timeout"
    | "network_error";
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
  status?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  error?: string;
  errorCode?:
    | "bad_request"
    | "auth_error"
    | "rate_limit"
    | "server_error"
    | "timeout"
    | "network_error";
  errorMessage?: string; // Threads error_message if status is ERROR
}

/**
 * Parameters for publishing a container
 */
export interface PublishContainerParams {
  accessToken: string;
  threadsUserId: string;
  containerId: string;
}

/**
 * Response from publishing a container
 */
export interface PublishContainerResponse {
  success: boolean;
  mediaId?: string;
  error?: string;
  errorCode?:
    | "bad_request"
    | "auth_error"
    | "rate_limit"
    | "server_error"
    | "timeout"
    | "network_error";
}

/**
 * Threads API response for container creation
 */
interface ThreadsContainerResponse {
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
 * Threads API response for container status
 */
interface ThreadsStatusResponse {
  status?: string;
  error_message?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Threads API response for container publish
 */
interface ThreadsPublishResponse {
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
 * This function initiates a video upload to Threads by creating a media container.
 * Threads downloads and processes the video from the provided URL.
 *
 * @param {CreateContainerParams} params - Container creation parameters
 * @returns {Promise<CreateContainerResponse>} Container creation result with container ID or error
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
 *   accessToken: 'TH_TOKEN...',
 *   threadsUserId: '123456789',
 *   videoUrl: 'https://s3.eu-central-003.backblazeb2.com/file/bucket/video.mp4?Authorization=...',
 *   text: 'My Video Title\n\nMy video description'
 * });
 */
export async function createMediaContainer(
  params: CreateContainerParams,
): Promise<CreateContainerResponse> {
  const { accessToken, threadsUserId, videoUrl, text } = params;

  try {
    // Create abort controller for 30-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Construct the API URL
    const url = new URL(`https://graph.threads.net/v1.0/${threadsUserId}/threads`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        media_type: "VIDEO",
        video_url: videoUrl,
        text: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: ThreadsContainerResponse = await response.json();

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
          error: data.error?.message || "Threads server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "bad_request",
      };
    }

    // Extract container ID from successful response
    if (!data.id) {
      return {
        success: false,
        error: "No container ID in response",
        errorCode: "bad_request",
      };
    }

    return {
      success: true,
      containerId: data.id,
    };
  } catch (error) {
    // Handle timeout and network errors
    // , 11.10
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
      errorCode: "network_error",
    };
  }
}

/**
 * Poll the status of a media container
 *
 * This function checks the current processing status of a media container.
 * Threads processes videos asynchronously. Per Meta's API documentation,
 * containers should be polled once per minute for no more than 5 minutes.
 *
 * @param {PollContainerStatusParams} params - Parameters including access token and container ID
 * @returns {Promise<PollContainerStatusResponse>} Status result with current processing status
 *
 *
 * Status Values:
 * - EXPIRED: Container not published within 24 hours
 * - ERROR: Processing failed (includes error_message field)
 * - FINISHED: Video processing complete, ready to publish
 * - IN_PROGRESS: Threads is still processing the video
 * - PUBLISHED: Container has already been published
 *
 * Error Message Types (when status=ERROR):
 * - FAILED_DOWNLOADING_VIDEO
 * - FAILED_PROCESSING_AUDIO
 * - FAILED_PROCESSING_VIDEO
 * - INVALID_ASPECT_RATIO (or INVALID_ASPEC_RATIO - API typo)
 * - INVALID_BIT_RATE
 * - INVALID_DURATION
 * - INVALID_FRAME_RATE
 * - INVALID_AUDIO_CHANNELS
 * - INVALID_AUDIO_CHANNEL_LAYOUT
 * - UNKNOWN
 *
 * @example
 * const result = await pollContainerStatus({
 *   accessToken: 'TH_TOKEN...',
 *   containerId: 'container_123456'
 * });
 */
export async function pollContainerStatus(
  params: PollContainerStatusParams,
): Promise<PollContainerStatusResponse> {
  const { accessToken, containerId } = params;

  try {
    // Create abort controller for 10-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL
    const url = new URL(`https://graph.threads.net/v1.0/${containerId}`);
    url.searchParams.append("fields", "status,error_message");
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: ThreadsStatusResponse = await response.json();

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
          error: data.error?.message || "Threads server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "bad_request",
      };
    }

    // Extract status from successful response
    if (!data.status) {
      return {
        success: false,
        error: "No status in response",
        errorCode: "bad_request",
      };
    }

    const status = data.status as PollContainerStatusResponse["status"];

    // If status is ERROR, include the error_message
    if (status === "ERROR") {
      return {
        success: true,
        status,
        errorMessage: data.error_message || "Container processing failed",
      };
    }

    return {
      success: true,
      status,
    };
  } catch (error) {
    // Handle timeout and network errors
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
      errorCode: "network_error",
    };
  }
}

/**
 * Publish a media container to make it live on Threads
 *
 * This function publishes a processed media container on Threads.
 * The container must have status "FINISHED" before publishing.
 *
 * @param {PublishContainerParams} params - Parameters including access token, user ID, and container ID
 * @returns {Promise<PublishContainerResponse>} Publish result with media ID or error
 *
 * @example
 * const result = await publishContainer({
 *   accessToken: 'TH_TOKEN...',
 *   threadsUserId: '123456789',
 *   containerId: 'container_123456'
 * });
 */
export async function publishContainer(
  params: PublishContainerParams,
): Promise<PublishContainerResponse> {
  const { accessToken, threadsUserId, containerId } = params;

  try {
    // Create abort controller for 30-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Construct the API URL
    const url = new URL(`https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`);
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
    const data: ThreadsPublishResponse = await response.json();

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
          error: data.error?.message || "Threads server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "bad_request",
      };
    }

    // Extract media ID from successful response
    if (!data.id) {
      return {
        success: false,
        error: "No media ID in response",
        errorCode: "bad_request",
      };
    }

    return {
      success: true,
      mediaId: data.id,
    };
  } catch (error) {
    // Handle timeout and network errors
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
      errorCode: "network_error",
    };
  }
}

/**
 * Parameters for refreshing an access token
 */
export interface RefreshTokenParams {
  encryptedAccessToken: string; // Encrypted access token to refresh
}

/**
 * Response from refreshing an access token
 */
export interface RefreshTokenResponse {
  success: boolean;
  encryptedAccessToken?: string; // New encrypted access token
  expiresAt?: Date; // New expiration timestamp
  error?: string;
  errorCode?:
    | "bad_request"
    | "auth_error"
    | "rate_limit"
    | "server_error"
    | "timeout"
    | "network_error";
}

/**
 * Threads API response for token refresh
 */
interface ThreadsRefreshTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number; // Typically 5183944 seconds (~60 days)
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Refresh a Threads access token
 *
 * This function refreshes an expiring Threads access token. Threads uses the
 * access_token itself for refresh operations (no separate refresh_token).
 * For users with public profiles, refreshing extends the permission grant for
 * another 90 days. Private profile users must re-authorize after 90 days.
 *
 * @param {RefreshTokenParams} params - Parameters including encrypted access token
 * @returns {Promise<RefreshTokenResponse>} Refresh result with new encrypted token and expiration
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 10-second timeout → Returns timeout error
 *
 * @example
 * const result = await refreshThreadsToken({
 *   encryptedAccessToken: 'a1b2c3d4e5f6....:1234abcd....:5678efgh....'
 * });
 */
export async function refreshThreadsToken(
  params: RefreshTokenParams,
): Promise<RefreshTokenResponse> {
  const { encryptedAccessToken } = params;

  // Import encryption functions
  const { decryptToken, encryptToken } = await import("../encryption");

  try {
    // Decrypt the current access token
    const currentToken = decryptToken(encryptedAccessToken);

    // Create abort controller for 10-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL
    const url = new URL("https://graph.threads.net/refresh_access_token");
    url.searchParams.append("grant_type", "th_refresh_token");
    url.searchParams.append("access_token", currentToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: ThreadsRefreshTokenResponse = await response.json();

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
          error: data.error?.message || "Token refresh failed - authentication error",
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
          error: data.error?.message || "Threads server error",
          errorCode: "server_error",
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status} error`,
        errorCode: "bad_request",
      };
    }

    // Extract access_token, token_type, and expires_in from response
    if (!data.access_token || !data.expires_in) {
      return {
        success: false,
        error: "Missing access_token or expires_in in response",
        errorCode: "bad_request",
      };
    }

    // Calculate new expiration timestamp
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Encrypt new access_token using AES-256-GCM
    const newEncryptedToken = encryptToken(data.access_token);

    return {
      success: true,
      encryptedAccessToken: newEncryptedToken,
      expiresAt,
    };
  } catch (error) {
    // Handle timeout and network errors
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
      errorCode: "network_error",
    };
  }
}
