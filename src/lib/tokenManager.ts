import { SocialAccount } from "@prisma/client";
import { decryptToken, encryptToken } from "./encryption";
import { getPrisma } from "./prisma";

/**
 * TikTok OAuth token endpoint
 */
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

/**
 * Google OAuth token endpoint
 */
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Instagram token refresh endpoint
 */
const INSTAGRAM_REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

/**
 * Token refresh buffer time in milliseconds (5 minutes)
 * Tokens will be refreshed if they expire within this window
 */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Maximum number of retry attempts for token refresh
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial retry delay in milliseconds
 */
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Checks if a token is expired or will expire soon
 *
 * @param socialAccount - The SocialAccount record to check
 * @returns True if the token needs to be refreshed, false otherwise
 *
 * @example
 * const needsRefresh = isTokenExpired(socialAccount);
 * if (needsRefresh) {
 *   await refreshToken(socialAccount);
 * }
 */
export function isTokenExpired(socialAccount: SocialAccount): boolean {
  if (!socialAccount.expiresAt) {
    // If no expiration time is set, assume token is valid
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(socialAccount.expiresAt);
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  // Return true if token is expired or expires within 5 minutes
  return timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Result of a token refresh operation
 */
export interface TokenRefreshResult {
  success: boolean;
  error?: string;
  updatedAccount?: SocialAccount;
}

/**
 * Refreshes an expired or expiring OAuth token
 *
 * @param socialAccount - The SocialAccount record with the token to refresh
 * @param userId - The ID of the user requesting the refresh (for authorization check)
 * @returns TokenRefreshResult indicating success or failure
 *
 * @example
 * const result = await refreshToken(socialAccount, user.id);
 * if (result.success) {
 *   console.log('Token refreshed successfully');
 * } else {
 *   console.error('Token refresh failed:', result.error);
 * }
 */
export async function refreshToken(
  socialAccount: SocialAccount,
  userId?: string,
): Promise<TokenRefreshResult> {
  // Authorization check: Validate user owns SocialAccount
  // Requirement: 10.12 - Validate user owns SocialAccount before token refresh
  if (userId && socialAccount.userId !== userId) {
    console.error("Authorization failed: User does not own SocialAccount:", {
      requestingUserId: userId,
      accountUserId: socialAccount.userId,
      platform: socialAccount.platform,
    });
    return {
      success: false,
      error: "Unauthorized: You do not own this account",
    };
  }

  // Instagram uses access token for refresh, not a separate refresh token
  // For other platforms, validate that we have a refresh token
  if (socialAccount.platform !== "Instagram" && !socialAccount.refreshToken) {
    return {
      success: false,
      error: "No refresh token available",
    };
  }

  // Decrypt the refresh token (or access token for Instagram)
  let decryptedRefreshToken: string;
  try {
    if (socialAccount.platform === "Instagram") {
      // Instagram uses the access token itself for refresh
      decryptedRefreshToken = decryptToken(socialAccount.accessToken);
    } else {
      // Other platforms use a separate refresh token
      decryptedRefreshToken = decryptToken(socialAccount.refreshToken!);
    }
  } catch (error) {
    console.error("Failed to decrypt refresh token:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: "Failed to decrypt refresh token",
    };
  }

  // Get environment variables based on platform
  let clientKey: string | undefined;
  let clientSecret: string | undefined;
  let tokenUrl: string;

  if (socialAccount.platform === "TikTok") {
    clientKey = process.env.TIKTOK_CLIENT_KEY;
    clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    tokenUrl = TIKTOK_TOKEN_URL;
  } else if (socialAccount.platform === "YouTube") {
    clientKey = process.env.YOUTUBE_CLIENT_ID;
    clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    tokenUrl = GOOGLE_TOKEN_URL;
  } else if (socialAccount.platform === "Instagram") {
    // Instagram doesn't use client credentials for token refresh
    // It uses the access token itself with grant_type=ig_refresh_token
    clientKey = undefined;
    clientSecret = undefined;
    tokenUrl = INSTAGRAM_REFRESH_URL;
  } else {
    console.error("Unsupported platform for token refresh:", socialAccount.platform);
    return {
      success: false,
      error: "Unsupported platform",
    };
  }

  if (socialAccount.platform !== "Instagram" && (!clientKey || !clientSecret)) {
    console.error(`Missing ${socialAccount.platform} OAuth credentials`);
    return {
      success: false,
      error: "OAuth configuration error",
    };
  }

  // Attempt token refresh with retry logic
  let lastError: string = "";
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await attemptTokenRefresh(
        socialAccount.platform,
        clientKey,
        clientSecret,
        decryptedRefreshToken,
        tokenUrl,
      );

      if (result.success && result.tokens) {
        // Update the SocialAccount with new tokens
        // For YouTube, Google doesn't return a new refresh_token on refresh
        // so we keep the existing one
        const newRefreshToken = result.tokens.refreshToken || decryptedRefreshToken;
        return await updateSocialAccountTokens(
          socialAccount,
          result.tokens.accessToken,
          newRefreshToken,
          result.tokens.expiresIn,
        );
      }

      // If rate limited, don't retry immediately
      // Requirement: 8.6 - Handle rate limit errors
      if (result.isRateLimited) {
        console.error(`Token refresh rate limited by ${socialAccount.platform} API:`, {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          retryAfter: result.retryAfter,
        });
        return {
          success: false,
          error: result.error || "Rate limit exceeded",
        };
      }

      // If invalid_grant error, don't retry
      if (result.error === "invalid_grant") {
        console.error(`[refreshToken] Invalid grant error - deactivating account:`, {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          timestamp: new Date().toISOString(),
          hint: "User needs to reconnect their account",
        });
        await deactivateSocialAccount(socialAccount);
        return {
          success: false,
          error: "Refresh token is invalid or expired. Please reconnect your account.",
        };
      }

      // If timeout error, allow retry with backoff
      if (result.isTimeout) {
        lastError = result.error || "Request timeout";
        console.warn(`Token refresh timeout on attempt ${attempt}:`, {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          attempt,
        });
      } else {
        lastError = result.error || "Unknown error";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Network error";
      console.error(`Token refresh attempt ${attempt} failed:`, {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        attempt,
        error: lastError,
      });

      // If this isn't the last attempt, wait before retrying with exponential backoff
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  console.error("Token refresh failed after all retries:", {
    userId: socialAccount.userId,
    platform: socialAccount.platform,
    attempts: MAX_RETRY_ATTEMPTS,
    lastError,
  });

  return {
    success: false,
    error: `Token refresh failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError}`,
  };
}

/**
 * Internal function to attempt a single token refresh request
 */
async function attemptTokenRefresh(
  platform: string,
  clientKey: string | undefined,
  clientSecret: string | undefined,
  refreshToken: string,
  tokenUrl: string,
): Promise<{
  success: boolean;
  tokens?: {
    accessToken: string;
    refreshToken?: string; // Optional for YouTube (Google doesn't return new refresh_token)
    expiresIn: number;
  };
  error?: string;
  isRateLimited?: boolean;
  retryAfter?: number;
  isTimeout?: boolean;
}> {
  // Requirement: 8.7 - Handle network timeouts
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let response: Response;
  try {
    if (platform === "Instagram") {
      // Instagram uses GET request with access_token as query parameter
      const url = new URL(tokenUrl);
      url.searchParams.append("grant_type", "ig_refresh_token");
      url.searchParams.append("access_token", refreshToken);

      response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
    } else {
      // TikTok and YouTube use POST with form data
      let params: URLSearchParams;

      if (platform === "TikTok") {
        params = new URLSearchParams({
          client_key: clientKey!,
          client_secret: clientSecret!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
      } else if (platform === "YouTube") {
        params = new URLSearchParams({
          client_id: clientKey!,
          client_secret: clientSecret!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
      } else {
        return {
          success: false,
          error: "Unsupported platform",
        };
      }

      response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: controller.signal,
      });
    }
  } catch (fetchError) {
    clearTimeout(timeout);

    // Check if error is due to timeout/abort
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      return {
        success: false,
        error: "Request timeout. Please try again.",
        isTimeout: true,
      };
    }

    // Re-throw other fetch errors to be caught by retry logic
    throw fetchError;
  } finally {
    clearTimeout(timeout);
  }

  // Requirement: 8.6 - Handle rate limit errors from TikTok API
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
    return {
      success: false,
      error: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      isRateLimited: true,
      retryAfter,
    };
  }

  const data = await response.json();

  if (!response.ok || data.error) {
    // Enhanced error logging for debugging
    console.error(`[attemptTokenRefresh] ${platform} token refresh failed:`, {
      status: response.status,
      error: data.error,
      errorDescription: data.error_description,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: data.error || data.error_description || "Token refresh failed",
    };
  }

  // Parse response based on platform
  // TikTok returns: access_token, refresh_token, expires_in
  // Google returns: access_token, expires_in (no new refresh_token)
  // Instagram returns: access_token, expires_in (no refresh_token)
  return {
    success: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // Will be undefined for YouTube and Instagram
      expiresIn: data.expires_in,
    },
  };
}

/**
 * Updates a SocialAccount record with new tokens
 */
async function updateSocialAccountTokens(
  socialAccount: SocialAccount,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<TokenRefreshResult> {
  try {
    // Encrypt the new tokens
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string | null = null;

    try {
      encryptedAccessToken = encryptToken(accessToken);
      
      // Instagram doesn't have a separate refresh token
      if (socialAccount.platform !== "Instagram") {
        encryptedRefreshToken = encryptToken(refreshToken);
      }
    } catch (encryptionError) {
      // Requirement: 10.14 - Log encryption errors without logging plaintext tokens
      // Requirement: 10.15 - Never log plaintext tokens
      console.error("[updateSocialAccountTokens] Token encryption failed:", {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        timestamp: new Date().toISOString(),
        error:
          encryptionError instanceof Error ? encryptionError.message : "Unknown encryption error",
      });
      return {
        success: false,
        error: "Failed to encrypt tokens",
      };
    }

    // Calculate new expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Update the database
    const prisma = getPrisma();
    const updateData: {
      accessToken: string;
      refreshToken?: string | null;
      expiresAt: Date;
      updatedAt: Date;
    } = {
      accessToken: encryptedAccessToken,
      expiresAt,
      updatedAt: new Date(),
    };

    // Only update refreshToken for platforms that use it
    if (socialAccount.platform !== "Instagram") {
      updateData.refreshToken = encryptedRefreshToken;
    }

    const updatedAccount = await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: updateData,
    });

    console.log("Token refreshed successfully:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      expiresAt,
    });

    return {
      success: true,
      updatedAccount,
    };
  } catch (error) {
    console.error("Failed to update SocialAccount with new tokens:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: "Failed to update account with new tokens",
    };
  }
}

/**
 * Deactivates a SocialAccount when refresh token is invalid
 */
async function deactivateSocialAccount(socialAccount: SocialAccount): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log("SocialAccount deactivated due to invalid refresh token:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
    });
  } catch (error) {
    console.error("Failed to deactivate SocialAccount:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Utility function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets a valid access token for a SocialAccount, refreshing if necessary
 *
 * @param socialAccount - The SocialAccount record
 * @param userId - The ID of the user requesting the token (for authorization check)
 * @returns The decrypted access token, or null if refresh failed
 *
 * @example
 * const accessToken = await getValidAccessToken(socialAccount, user.id);
 * if (accessToken) {
 *   // Use the token for API requests
 * } else {
 *   // Handle token refresh failure
 * }
 */
export async function getValidAccessToken(
  socialAccount: SocialAccount,
  userId?: string,
): Promise<string | null> {
  // Authorization check: Validate user owns SocialAccount
  // Requirement: 10.12 - Validate user owns SocialAccount before token access
  if (userId && socialAccount.userId !== userId) {
    console.error("Authorization failed: User does not own SocialAccount:", {
      requestingUserId: userId,
      accountUserId: socialAccount.userId,
      platform: socialAccount.platform,
    });
    return null;
  }

  // Check if token needs refresh
  if (isTokenExpired(socialAccount)) {
    const result = await refreshToken(socialAccount, userId);
    if (!result.success || !result.updatedAccount) {
      return null;
    }
    // Use the updated account with new tokens
    socialAccount = result.updatedAccount;
  }

  // Decrypt and return the access token
  try {
    return decryptToken(socialAccount.accessToken);
  } catch (error) {
    console.error("Failed to decrypt access token:", {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
