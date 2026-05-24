/**
 * Facebook Pages API Integration Module
 *
 * This module encapsulates all Facebook Pages API interactions for video uploads using
 * Facebook's resumable upload system. Videos are published directly to Facebook Pages.
 *
 */

/**
 * Parameters for initializing an upload session
 */
export interface InitializeUploadSessionParams {
  accessToken: string;
  appId: string;
  fileName: string;
  fileLength: number;
  fileType: string;
}

/**
 * Response from initializing an upload session
 */
export interface InitializeUploadSessionResponse {
  success: boolean;
  uploadSessionId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parameters for uploading a video file
 */
export interface UploadVideoFileParams {
  accessToken: string;
  uploadSessionId: string;
  videoData: ArrayBuffer | Uint8Array | Buffer;
}

/**
 * Response from uploading a video file
 */
export interface UploadVideoFileResponse {
  success: boolean;
  fileHandle?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parameters for publishing a video
 */
export interface PublishVideoParams {
  accessToken: string;
  pageId: string;
  fileHandle: string;
  description: string;
}

/**
 * Response from publishing a video
 */
export interface PublishVideoResponse {
  success: boolean;
  videoId?: string;
  platformUrl?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parameters for refreshing a Facebook token
 */
export interface RefreshFacebookTokenParams {
  accessToken: string;
}

/**
 * Response from refreshing a Facebook token
 */
export interface RefreshFacebookTokenResponse {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Facebook API response for upload session initialization
 */
interface FacebookUploadSessionResponse {
  upload_session_id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Facebook API response for video file upload
 */
interface FacebookFileUploadResponse {
  file_handle?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Facebook API response for video publishing
 */
interface FacebookPublishResponse {
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
 * Facebook API response for token refresh
 */
interface FacebookTokenRefreshResponse {
  access_token?: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Initialize a resumable upload session for video upload
 *
 * This function creates a resumable upload session on Facebook's servers.
 * The session is used to upload large video files reliably.
 *
 * @param {InitializeUploadSessionParams} params - Upload session initialization parameters
 * @returns {Promise<InitializeUploadSessionResponse>} Upload session initialization result with session ID or error
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 10-second timeout → Returns timeout error
 *
 * @example
 * const result = await initializeUploadSession({
 *   accessToken: 'EAABwzLixnjYBO...',
 *   appId: '853830931088704',
 *   fileName: 'video.mp4',
 *   fileLength: 1024000,
 *   fileType: 'video/mp4'
 * });
 */
export async function initializeUploadSession(
  params: InitializeUploadSessionParams,
): Promise<InitializeUploadSessionResponse> {
  const { accessToken, appId, fileName, fileLength, fileType } = params;

  try {
    // Create abort controller for 10-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL
    const url = new URL(`https://graph.facebook.com/v25.0/${appId}/uploads`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: fileName,
        file_length: fileLength,
        file_type: fileType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: FacebookUploadSessionResponse = await response.json();

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
          error: data.error?.message || "Facebook server error",
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

    // Extract upload session ID from successful response
    //
    if (!data.upload_session_id) {
      return {
        success: false,
        error: "No upload session ID in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      uploadSessionId: data.upload_session_id,
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
 * Upload a video file to a resumable upload session
 *
 * This function uploads the video file data to the previously initialized
 * upload session. The file is uploaded as binary data.
 *
 * @param {UploadVideoFileParams} params - Parameters including access token, session ID, and video data
 * @returns {Promise<UploadVideoFileResponse>} Upload result with file handle or error
 *
 *.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 60-second timeout → Returns timeout error
 *
 * @example
 * const result = await uploadVideoFile({
 *   accessToken: 'EAABwzLixnjYBO...',
 *   uploadSessionId: '1234567890',
 *   videoData: videoBuffer
 * });
 */
export async function uploadVideoFile(
  params: UploadVideoFileParams,
): Promise<UploadVideoFileResponse> {
  const { accessToken, uploadSessionId, videoData } = params;

  try {
    // Create abort controller for 60-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Construct the API URL
    const url = new URL(`https://graph.facebook.com/v25.0/${uploadSessionId}`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: videoData as BodyInit,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: FacebookFileUploadResponse = await response.json();

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
          error: data.error?.message || "Facebook server error",
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

    // Extract file handle from successful response
    //
    if (!data.file_handle) {
      return {
        success: false,
        error: "No file handle in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      fileHandle: data.file_handle,
    };
  } catch (error) {
    // Handle timeout and network errors
    //
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout after 60 seconds",
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
 * Publish a video to a Facebook Page
 *
 * This function publishes the uploaded video to the specified Facebook Page.
 * The file_handle from the upload step is used as the file_url parameter.
 *
 * @param {PublishVideoParams} params - Parameters including access token, page ID, file handle, and description
 * @returns {Promise<PublishVideoResponse>} Publish result with video ID and platform URL or error
 *
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 10-second timeout → Returns timeout error
 *
 * @example
 * const result = await publishVideo({
 *   accessToken: 'EAABwzLixnjYBO...',
 *   pageId: '123456789',
 *   fileHandle: 'file_handle_from_upload',
 *   description: 'My Video Title\n\nMy video description'
 * });
 */
export async function publishVideo(params: PublishVideoParams): Promise<PublishVideoResponse> {
  const { accessToken, pageId, fileHandle, description } = params;

  try {
    // Create abort controller for 10-second timeout
    //
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL
    const url = new URL(`https://graph.facebook.com/v25.0/${pageId}/videos`);
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_url: fileHandle, // Note: file_handle is passed as file_url parameter
        description: description,
        published: true, // Publish immediately
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: FacebookPublishResponse = await response.json();

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
          error: data.error?.message || "Facebook server error",
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

    // Extract video ID from successful response
    //
    if (!data.id) {
      return {
        success: false,
        error: "No video ID in response",
        errorCode: "invalid_response",
      };
    }

    // Construct platform URL
    //
    const platformUrl = `https://www.facebook.com/${pageId}/videos/${data.id}`;

    return {
      success: true,
      videoId: data.id,
      platformUrl: platformUrl,
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
 * Refresh a Facebook access token for edge cases with expiring tokens
 *
 * This function refreshes a Facebook access token by exchanging it for a new one.
 * Note: Page tokens obtained from long-lived user tokens are never-expiring and
 * typically don't require refresh. This handles edge cases where tokens may expire.
 *
 * @param {RefreshFacebookTokenParams} params - Parameters including the current access token
 * @returns {Promise<RefreshFacebookTokenResponse>} Refresh result with new token or error
 *
 * Error Handling:
 * - HTTP 400: Invalid request parameters → Returns bad_request error
 * - HTTP 401/403: Token expired or invalid → Returns auth_error
 * - HTTP 429: Rate limit exceeded → Returns rate_limit error
 * - HTTP 5xx: Server error → Returns server_error
 * - Network timeout: 10-second timeout → Returns timeout error
 *
 * @example
 * const result = await refreshFacebookToken({
 *   accessToken: 'EAABwzLixnjYBO...'
 * });
 */
export async function refreshFacebookToken(
  params: RefreshFacebookTokenParams,
): Promise<RefreshFacebookTokenResponse> {
  const { accessToken } = params;

  // Get Facebook app credentials from environment
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      success: false,
      error: "Facebook app credentials not configured",
      errorCode: "config_error",
    };
  }

  try {
    // Create abort controller for 10-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct the API URL for token refresh
    const url = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
    url.searchParams.append("grant_type", "fb_exchange_token");
    url.searchParams.append("client_id", appId);
    url.searchParams.append("client_secret", appSecret);
    url.searchParams.append("fb_exchange_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data: FacebookTokenRefreshResponse = await response.json();

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
          error: data.error?.message || "Facebook server error",
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

    // Extract new access token from successful response
    if (!data.access_token) {
      return {
        success: false,
        error: "No access token in response",
        errorCode: "invalid_response",
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
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
      errorCode: "unknown_error",
    };
  }
}
