import { SocialAccount } from '@prisma/client';
import { decryptToken, encryptToken } from './encryption';
import { getPrisma } from './prisma';

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export function isTokenExpired(socialAccount: SocialAccount): boolean {
  if (!socialAccount.expiresAt) {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(socialAccount.expiresAt);
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  return timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS;
}

export interface TokenRefreshResult {
  success: boolean;
  error?: string;
  updatedAccount?: SocialAccount;
}

export async function refreshToken(
  socialAccount: SocialAccount,
  userId?: string
): Promise<TokenRefreshResult> {
  if (userId && socialAccount.userId !== userId) {
    console.error('Authorization failed: User does not own SocialAccount:', {
      requestingUserId: userId,
      accountUserId: socialAccount.userId,
      platform: socialAccount.platform,
    });
    return {
      success: false,
      error: 'Unauthorized: You do not own this account',
    };
  }

  if (!socialAccount.refreshToken) {
    return {
      success: false,
      error: 'No refresh token available',
    };
  }

  let decryptedRefreshToken: string;
  try {
    decryptedRefreshToken = decryptToken(socialAccount.refreshToken);
  } catch (error) {
    console.error('Failed to decrypt refresh token:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: 'Failed to decrypt refresh token',
    };
  }

  let clientKey: string | undefined;
  let clientSecret: string | undefined;
  let tokenUrl: string;

  if (socialAccount.platform === 'TikTok') {
    clientKey = process.env.TIKTOK_CLIENT_KEY;
    clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    tokenUrl = TIKTOK_TOKEN_URL;
  } else if (socialAccount.platform === 'YouTube') {
    clientKey = process.env.YOUTUBE_CLIENT_ID;
    clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    tokenUrl = GOOGLE_TOKEN_URL;
  } else {
    console.error('Unsupported platform for token refresh:', socialAccount.platform);
    return {
      success: false,
      error: 'Unsupported platform',
    };
  }

  if (!clientKey || !clientSecret) {
    console.error(`Missing ${socialAccount.platform} OAuth credentials`);
    return {
      success: false,
      error: 'OAuth configuration error',
    };
  }

  let lastError: string = '';
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await attemptTokenRefresh(
        socialAccount.platform,
        clientKey,
        clientSecret,
        decryptedRefreshToken,
        tokenUrl
      );

      if (result.success && result.tokens) {
        const newRefreshToken = result.tokens.refreshToken || decryptedRefreshToken;
        return await updateSocialAccountTokens(
          socialAccount,
          result.tokens.accessToken,
          newRefreshToken,
          result.tokens.expiresIn
        );
      }

      if (result.isRateLimited) {
        console.error(`Token refresh rate limited by ${socialAccount.platform} API:`, {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          retryAfter: result.retryAfter,
        });
        return {
          success: false,
          error: result.error || 'Rate limit exceeded',
        };
      }

      if (result.error === 'invalid_grant') {
        await deactivateSocialAccount(socialAccount);
        return {
          success: false,
          error: 'Refresh token is invalid or expired. Account deactivated.',
        };
      }

      if (result.isTimeout) {
        lastError = result.error || 'Request timeout';
        console.warn(`Token refresh timeout on attempt ${attempt}:`, {
          userId: socialAccount.userId,
          platform: socialAccount.platform,
          attempt,
        });
      } else {
        lastError = result.error || 'Unknown error';
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
      console.error(`Token refresh attempt ${attempt} failed:`, {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        attempt,
        error: lastError,
      });

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  console.error('Token refresh failed after all retries:', {
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

async function attemptTokenRefresh(
  platform: string,
  clientKey: string,
  clientSecret: string,
  refreshToken: string,
  tokenUrl: string
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
  let params: URLSearchParams;

  if (platform === 'TikTok') {
    params = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  } else if (platform === 'YouTube') {
    params = new URLSearchParams({
      client_id: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  } else {
    return {
      success: false,
      error: 'Unsupported platform',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeout);
    
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout. Please try again.',
        isTimeout: true,
      };
    }
    
    throw fetchError;
  } finally {
    clearTimeout(timeout);
  }

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
    return {
      success: false,
      error: data.error || data.error_description || 'Token refresh failed',
    };
  }

  return {
    success: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    },
  };
}

async function updateSocialAccountTokens(
  socialAccount: SocialAccount,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<TokenRefreshResult> {
  try {
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;

    try {
      encryptedAccessToken = encryptToken(accessToken);
      encryptedRefreshToken = encryptToken(refreshToken);
    } catch (encryptionError) {
      console.error('[updateSocialAccountTokens] Token encryption failed:', {
        userId: socialAccount.userId,
        platform: socialAccount.platform,
        timestamp: new Date().toISOString(),
        error: encryptionError instanceof Error ? encryptionError.message : 'Unknown encryption error',
      });
      return {
        success: false,
        error: 'Failed to encrypt tokens',
      };
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const prisma = getPrisma();
    const updatedAccount = await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    console.log('Token refreshed successfully:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      expiresAt,
    });

    return {
      success: true,
      updatedAccount,
    };
  } catch (error) {
    console.error('Failed to update SocialAccount with new tokens:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: 'Failed to update account with new tokens',
    };
  }
}

async function deactivateSocialAccount(
  socialAccount: SocialAccount
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log('SocialAccount deactivated due to invalid refresh token:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
    });
  } catch (error) {
    console.error('Failed to deactivate SocialAccount:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getValidAccessToken(
  socialAccount: SocialAccount,
  userId?: string
): Promise<string | null> {
  if (userId && socialAccount.userId !== userId) {
    console.error('Authorization failed: User does not own SocialAccount:', {
      requestingUserId: userId,
      accountUserId: socialAccount.userId,
      platform: socialAccount.platform,
    });
    return null;
  }

  if (isTokenExpired(socialAccount)) {
    const result = await refreshToken(socialAccount, userId);
    if (!result.success || !result.updatedAccount) {
      return null;
    }
    socialAccount = result.updatedAccount;
  }

  try {
    return decryptToken(socialAccount.accessToken);
  } catch (error) {
    console.error('Failed to decrypt access token:', {
      userId: socialAccount.userId,
      platform: socialAccount.platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
