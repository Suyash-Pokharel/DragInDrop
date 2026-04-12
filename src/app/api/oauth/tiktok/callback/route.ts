import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { encryptToken } from "@/lib/encryption";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { sanitizeTikTokProfile, validateRedirectUri, validateHttps } from "@/lib/sanitize";

/**
 * GET /api/oauth/tiktok/callback
 * Handles OAuth 2.0 callback from TikTok
 * Requirements: 2.1, 8.3, 10.13
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  // Requirement: 10.13 - Apply rate limiting to OAuth endpoints
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  
  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch (rateLimitError) {
    console.error("[GET /api/oauth/tiktok/callback] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  // Authenticate user
  // Requirement: 8.3 - Return 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/tiktok/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch (rateLimitError) {
    console.error("[GET /api/oauth/tiktok/callback] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const prisma = getPrisma();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle user authorization denial
    // Requirement: 8.1 - Handle authorization denial
    if (error) {
      console.log("[GET /api/oauth/tiktok/callback] Authorization denied:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error,
      });
      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Authorization denied")}`
      );
    }

    // Validate authorization code is present
    // Requirement: 8.2 - Return 400 if code is missing
    if (!code) {
      console.error("[GET /api/oauth/tiktok/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Verify CSRF token (state parameter)
    // Requirements: 2.2, 2.3, 2.4, 10.3, 10.4 - Verify state matches CSRF token
    const storedState = request.cookies.get("tiktok_oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid state parameter:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        stateProvided: !!state,
        stateStored: !!storedState,
        stateMatch: state === storedState,
      });
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Retrieve PKCE code_verifier from cookie
    const codeVerifier = request.cookies.get("tiktok_code_verifier")?.value;
    if (!codeVerifier) {
      console.error("[GET /api/oauth/tiktok/callback] Missing code_verifier:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Invalid OAuth session" },
        { status: 400 }
      );
    }

    // Validate redirect URI
    // Requirements: 10.10, 10.11 - Validate redirect_uri matches configured value
    const redirectUri = `${appUrl}/api/oauth/tiktok/callback`;
    const isProduction = process.env.NODE_ENV === "production";
    
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid redirect URI protocol:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        redirectUri,
        isProduction,
      });
      return NextResponse.json(
        { error: "OAuth configuration error: HTTPS required in production" },
        { status: 500 }
      );
    }

    // Validate OAuth configuration
    // Requirement: 8.4 - Return 500 if credentials missing
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      console.error("[GET /api/oauth/tiktok/callback] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    // Requirements: 2.5, 2.6, 2.7, 2.8 - Token exchange with TikTok API
    const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";

    const tokenParams = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier, // PKCE code_verifier for token exchange
    });

    console.log("[GET /api/oauth/tiktok/callback] Exchanging authorization code:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientKey,
      codeLength: code.length,
      tokenParamsString: tokenParams.toString(),
    });

    // Requirement: 8.7 - Handle network timeouts with 504 response
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000); // 10 second timeout

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
        signal: tokenController.signal,
      });
    } catch (fetchError) {
      clearTimeout(tokenTimeout);
      
      // Check if error is due to timeout/abort
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/tiktok/callback] Token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    } finally {
      clearTimeout(tokenTimeout);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/tiktok/callback] Token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        error: errorData,
      });
      
      // Requirement: 8.6 - Handle rate limit errors from TikTok API
      if (tokenResponse.status === 429) {
        const retryAfter = tokenResponse.headers.get("retry-after") || "60";
        return NextResponse.json(
          { error: `Rate limit exceeded. Please try again after ${retryAfter} seconds.` },
          { 
            status: 429,
            headers: {
              "Retry-After": retryAfter,
            },
          }
        );
      }
      
      // Requirement: 8.5 - Handle redirect URI mismatch
      // TikTok returns error codes like "redirect_uri_mismatch" or error descriptions
      const errorCode = errorData.error || errorData.error_code;
      const errorDescription = errorData.error_description || errorData.message;
      
      if (errorCode === "redirect_uri_mismatch" || 
          (errorDescription && errorDescription.toLowerCase().includes("redirect"))) {
        return NextResponse.redirect(
          `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Redirect URI mismatch")}`
        );
      }
      
      // Requirement: 2.11 - Return 500 if token exchange fails
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      open_id,
      scope,
    } = tokenData;

    if (!access_token || !refresh_token || !open_id) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        hasOpenId: !!open_id,
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    }

    // Fetch TikTok user profile
    // Requirements: 2.9, 2.10 - Fetch user profile
    console.log("[GET /api/oauth/tiktok/callback] Fetching TikTok profile:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      openId: open_id,
      hasAccessToken: !!access_token,
    });

    const profileUrl = "https://open.tiktokapis.com/v2/user/info/";
    // Only request fields available with user.info.basic scope
    // username requires user.info.profile scope which we don't have
    const profileParams = new URLSearchParams({
      fields: "open_id,union_id,avatar_url,display_name",
    });

    // Requirement: 8.7 - Handle network timeouts with 504 response
    const profileController = new AbortController();
    const profileTimeout = setTimeout(() => profileController.abort(), 10000); // 10 second timeout

    let profileResponse: Response;
    try {
      profileResponse = await fetch(`${profileUrl}?${profileParams.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        signal: profileController.signal,
      });
    } catch (fetchError) {
      clearTimeout(profileTimeout);
      
      // Check if error is due to timeout/abort
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/tiktok/callback] Profile fetch timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    } finally {
      clearTimeout(profileTimeout);
    }

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/tiktok/callback] Profile fetch failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: profileResponse.status,
        error: errorData,
        responseHeaders: Object.fromEntries(profileResponse.headers.entries()),
      });
      
      // Requirement: 8.6 - Handle rate limit errors from TikTok API
      if (profileResponse.status === 429) {
        const retryAfter = profileResponse.headers.get("retry-after") || "60";
        return NextResponse.json(
          { error: `Rate limit exceeded. Please try again after ${retryAfter} seconds.` },
          { 
            status: 429,
            headers: {
              "Retry-After": retryAfter,
            },
          }
        );
      }
      
      // If profile fetch fails due to scope issues, we can still save the account
      // We'll use open_id as the username fallback
      console.warn("[GET /api/oauth/tiktok/callback] Profile fetch failed, using open_id as fallback:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        openId: open_id,
      });
      
      // Use open_id as platformUsername fallback
      const platformUsername = open_id;
      
      // Continue with account save using minimal data
      const expiresAt = new Date(Date.now() + expires_in * 1000);
      
      let encryptedAccessToken: string;
      let encryptedRefreshToken: string;

      try {
        encryptedAccessToken = encryptToken(access_token);
        encryptedRefreshToken = encryptToken(refresh_token);
      } catch (encryptionError) {
        console.error("[GET /api/oauth/tiktok/callback] Token encryption failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: encryptionError instanceof Error ? encryptionError.message : "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to save account connection" },
          { status: 500 }
        );
      }

      try {
        await prisma.socialAccount.upsert({
          where: {
            userId_platform_platformAccountId: {
              userId: user.id,
              platform: "TikTok",
              platformAccountId: open_id,
            },
          },
          update: {
            platformUsername,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            isActive: true,
          },
          create: {
            userId: user.id,
            platform: "TikTok",
            platformAccountId: open_id,
            platformUsername,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            isActive: true,
          },
        });

        console.log("[GET /api/oauth/tiktok/callback] SocialAccount saved successfully (without profile):", {
          userId: user.id,
          platform: "TikTok",
          timestamp: new Date().toISOString(),
        });
        
        const response = NextResponse.redirect(
          `${appUrl}/settings/social-accounts?success=${encodeURIComponent("TikTok account connected successfully")}`
        );
        response.cookies.delete("tiktok_oauth_state");
        response.cookies.delete("tiktok_code_verifier");
        return response;
      } catch (dbError) {
        console.error("[GET /api/oauth/tiktok/callback] Database error:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: dbError instanceof Error ? dbError.message : "Unknown error",
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });
        return NextResponse.json(
          { error: "Failed to save account connection" },
          { status: 500 }
        );
      }
    }

    const profileData = await profileResponse.json();
    const tiktokUser = profileData.data?.user;

    console.log("[GET /api/oauth/tiktok/callback] Profile data received:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      hasUser: !!tiktokUser,
      profileData: profileData,
    });

    // Use display_name or open_id as fallback (username requires user.info.profile scope)
    const platformUsername = tiktokUser?.display_name || open_id;

    // Calculate token expiration timestamp
    // Requirement: 3.1 - Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Encrypt tokens before storage
    // Requirements: 10.5, 10.6 - Encrypt tokens
    console.log("[GET /api/oauth/tiktok/callback] Encrypting tokens:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;

    try {
      encryptedAccessToken = encryptToken(access_token);
      encryptedRefreshToken = encryptToken(refresh_token);
    } catch (encryptionError) {
      // Requirement: 10.14 - Log encryption errors without plaintext tokens
      console.error("[GET /api/oauth/tiktok/callback] Token encryption failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: encryptionError instanceof Error ? encryptionError.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "Failed to save account connection" },
        { status: 500 }
      );
    }

    // Create or update SocialAccount record
    // Requirements: 3.2-3.11 - Upsert SocialAccount
    console.log("[GET /api/oauth/tiktok/callback] Saving SocialAccount:", {
      userId: user.id,
      platform: "TikTok",
      platformAccountId: open_id,
      timestamp: new Date().toISOString(),
    });

    try {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_platformAccountId: {
            userId: user.id,
            platform: "TikTok",
            platformAccountId: open_id,
          },
        },
        update: {
          platformUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
        },
        create: {
          userId: user.id,
          platform: "TikTok",
          platformAccountId: open_id,
          platformUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
        },
      });

      console.log("[GET /api/oauth/tiktok/callback] SocialAccount saved successfully:", {
        userId: user.id,
        platform: "TikTok",
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      // Requirement: 3.13 - Handle database errors
      console.error("[GET /api/oauth/tiktok/callback] Database error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: dbError instanceof Error ? dbError.message : "Unknown error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      return NextResponse.json(
        { error: "Failed to save account connection" },
        { status: 500 }
      );
    }

    // Clear CSRF token and code_verifier after successful validation
    // Requirement: 10.4 - Clear CSRF token
    const response = NextResponse.redirect(
      `${appUrl}/settings/social-accounts?success=${encodeURIComponent("TikTok account connected successfully")}`
    );
    response.cookies.delete("tiktok_oauth_state");
    response.cookies.delete("tiktok_code_verifier");

    return response;
  } catch (error) {
    // Requirement: 8.8 - Log errors with user context
    console.error("[GET /api/oauth/tiktok/callback] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to complete OAuth callback" },
      { status: 500 }
    );
  }
}
