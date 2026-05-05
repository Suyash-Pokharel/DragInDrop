import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { sanitizeInstagramProfile } from "@/lib/sanitize";
import { encryptToken } from "@/lib/encryption";
import { getPrisma } from "@/lib/prisma";

/**
 * GET /api/oauth/instagram/callback
 * Handles OAuth 2.0 callback from Facebook Login for Business (Instagram Graph API)
 * Updated 2024: Instagram Basic Display API deprecated, now using Facebook Login for Business
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.17, 2.18, 2.19, 2.20, 10.4, 10.5, 10.6, 12.9
 * 
 * Note: Facebook Login for Business returns tokens in URL fragment (#), not query params
 * The client-side redirect will convert fragment to query params for server processing
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  // Requirement: 2.1 - Return HTTP 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/instagram/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Extract query parameters
    // Requirement: 2.1 - Extract authorization code and state parameter from query string
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // Handle user authorization denial
    // Requirement: 2.20 - Handle user denial: if error=access_denied, redirect to settings
    if (error) {
      console.log("[GET /api/oauth/instagram/callback] Authorization denied:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error,
        errorReason,
        errorDescription,
      });
      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Authorization denied")}`,
      );
    }

    // Validate authorization code is present
    // Requirement: 2.18 - Return HTTP 400 if authorization code is missing
    if (!code) {
      console.error("[GET /api/oauth/instagram/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Retrieve CSRF token from cookie
    // Requirement: 2.2 - Retrieve CSRF token from cookie
    const storedState = request.cookies.get("instagram_oauth_state")?.value;

    // Validate state parameter matches stored CSRF token
    // Requirement: 2.3 - Validate state parameter matches stored CSRF token
    // Requirement: 2.19 - Return HTTP 400 if state parameter is invalid
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/instagram/callback] Invalid state parameter:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        stateProvided: !!state,
        stateStored: !!storedState,
        stateMatch: state === storedState,
      });
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    // Validate CSRF token has not expired (10-minute window)
    // Requirement: 2.4 - Validate CSRF token has not expired (10-minute window)
    // Note: Cookie expiration is handled by the browser. If the cookie exists, it's within the 10-minute window.
    // The cookie was set with maxAge=600 (10 minutes) in the authorize endpoint.
    // If we reach this point with a valid cookie, the token hasn't expired.

    // Log CSRF token validation success
    // Requirement: 12.9 - Log CSRF token validation failures with timestamp
    console.log("[GET /api/oauth/instagram/callback] CSRF token validated successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      codeLength: code.length,
    });

    // Validate OAuth configuration
    // Requirement: 2.6 - Include client_id and client_secret in token exchange
    const clientId = process.env.INSTAGRAM_APP_ID;
    const clientSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GET /api/oauth/instagram/callback] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET",
      });
      return NextResponse.json({ error: "OAuth configuration error" }, { status: 500 });
    }

    // Construct redirect URI
    const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

    // Exchange authorization code for short-lived access token
    // Requirements: 2.5, 2.6, 2.7 - Exchange code for short-lived token
    console.log("[GET /api/oauth/instagram/callback] Exchanging authorization code:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      codeLength: code.length,
    });

    const tokenUrl = "https://api.instagram.com/oauth/access_token";
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code,
    });

    // Requirement: 2.7 - Set 10-second timeout for token exchange
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000);

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

      // Requirement: 2.8 - Return HTTP 504 if timeout occurs
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/instagram/callback] Token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error("[GET /api/oauth/instagram/callback] Token exchange network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      // Requirement: 2.9 - Return HTTP 500 if token exchange fails
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    } finally {
      clearTimeout(tokenTimeout);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/instagram/callback] Token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        error: errorData,
      });

      // Requirement: 2.9 - Return HTTP 500 if token exchange fails
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token: shortLivedToken, user_id } = tokenData;

    // Requirement: 2.10 - Extract access_token and user_id from response
    if (!shortLivedToken || !user_id) {
      console.error("[GET /api/oauth/instagram/callback] Invalid token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!shortLivedToken,
        hasUserId: !!user_id,
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    }

    console.log("[GET /api/oauth/instagram/callback] Short-lived token obtained:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      instagramUserId: user_id,
    });

    // Exchange short-lived token for long-lived token
    // Requirements: 2.11, 2.12 - Exchange for long-lived token
    console.log("[GET /api/oauth/instagram/callback] Exchanging for long-lived token:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortLivedToken}`;

    // Requirement: 2.12 - Set 10-second timeout for long-lived token exchange
    const longLivedController = new AbortController();
    const longLivedTimeout = setTimeout(() => longLivedController.abort(), 10000);

    let longLivedResponse: Response;
    try {
      longLivedResponse = await fetch(longLivedTokenUrl, {
        method: "GET",
        signal: longLivedController.signal,
      });
    } catch (fetchError) {
      clearTimeout(longLivedTimeout);

      // Return HTTP 504 if timeout occurs
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/instagram/callback] Long-lived token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error("[GET /api/oauth/instagram/callback] Long-lived token exchange network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "Failed to exchange for long-lived token" },
        { status: 500 },
      );
    } finally {
      clearTimeout(longLivedTimeout);
    }

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/instagram/callback] Long-lived token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: longLivedResponse.status,
        error: errorData,
      });

      return NextResponse.json(
        { error: "Failed to exchange for long-lived token" },
        { status: 500 },
      );
    }

    const longLivedData = await longLivedResponse.json();
    const { access_token, expires_in } = longLivedData;

    // Requirement: 2.13 - Extract access_token and expires_in from response
    if (!access_token || !expires_in) {
      console.error("[GET /api/oauth/instagram/callback] Invalid long-lived token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!access_token,
        hasExpiresIn: !!expires_in,
      });
      return NextResponse.json(
        { error: "Failed to exchange for long-lived token" },
        { status: 500 },
      );
    }

    // Requirement: 2.14 - Calculate token expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    console.log("[GET /api/oauth/instagram/callback] Long-lived token obtained:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      expiresIn: expires_in,
      expiresAt: expiresAt.toISOString(),
    });

    // Fetch Instagram account profile
    // Requirements: 2.10, 2.11, 2.12 - Fetch profile and validate account type
    console.log("[GET /api/oauth/instagram/callback] Fetching Instagram profile:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    const profileUrl = `https://graph.instagram.com/me?fields=id,username,name,profile_picture_url,followers_count,account_type&access_token=${access_token}`;

    // Requirement: 2.11 - Set 10-second timeout for profile fetch request
    const profileController = new AbortController();
    const profileTimeout = setTimeout(() => profileController.abort(), 10000);

    let profileResponse: Response;
    try {
      profileResponse = await fetch(profileUrl, {
        method: "GET",
        signal: profileController.signal,
      });
    } catch (fetchError) {
      clearTimeout(profileTimeout);

      // Return HTTP 504 if timeout occurs
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/instagram/callback] Profile fetch timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error("[GET /api/oauth/instagram/callback] Profile fetch network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      // Requirement: 2.12 - Return HTTP 500 if profile fetch fails
      return NextResponse.json({ error: "Failed to fetch Instagram profile" }, { status: 500 });
    } finally {
      clearTimeout(profileTimeout);
    }

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/instagram/callback] Profile fetch failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: profileResponse.status,
        error: errorData,
      });

      // Requirement: 2.12 - Return HTTP 500 if profile fetch fails
      return NextResponse.json({ error: "Failed to fetch Instagram profile" }, { status: 500 });
    }

    const profileData = await profileResponse.json();

    // Requirement: 2.13 - Extract account details and sanitize inputs
    // Requirement: 10.9 - Sanitize all user inputs from Instagram API responses
    const sanitizedProfile = sanitizeInstagramProfile({
      id: profileData.id,
      username: profileData.username,
      name: profileData.name,
      profile_picture_url: profileData.profile_picture_url,
      followers_count: profileData.followers_count,
      account_type: profileData.account_type,
    });

    console.log("[GET /api/oauth/instagram/callback] Profile fetched successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      instagramUserId: sanitizedProfile.id,
      username: sanitizedProfile.username,
      accountType: sanitizedProfile.account_type,
    });

    // Requirement: 2.14 - Validate account_type is either "BUSINESS" or "CREATOR"
    // Requirement: 2.15 - If account_type is "PERSONAL", redirect with error
    // Note: Instagram API with Instagram Login returns "Business" or "Media_Creator"
    // Instagram API with Facebook Login returns "BUSINESS" or "CREATOR"
    // We need to handle both formats for compatibility
    const accountType = sanitizedProfile.account_type?.toUpperCase();
    const isValidAccount = 
      accountType === "BUSINESS" || 
      accountType === "CREATOR" || 
      accountType === "MEDIA_CREATOR";

    if (!isValidAccount) {
      console.log("[GET /api/oauth/instagram/callback] Invalid account type:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        accountType: sanitizedProfile.account_type,
        accountTypeUpperCase: accountType,
      });

      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Instagram Business or Creator account required")}`,
      );
    }

    // Encrypt access token before storage
    // Requirements: 2.13, 10.1, 10.2, 10.3 - Encrypt access_token using AES-256-GCM
    console.log("[GET /api/oauth/instagram/callback] Encrypting access token:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    let encryptedAccessToken: string;

    try {
      encryptedAccessToken = encryptToken(access_token);
    } catch (encryptionError) {
      // Log encryption errors without plaintext tokens
      console.error("[GET /api/oauth/instagram/callback] Token encryption failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: encryptionError instanceof Error ? encryptionError.message : "Unknown error",
      });
      // Requirement: 2.24 - Return HTTP 500 if database save fails
      return NextResponse.json({ error: "Failed to save account connection" }, { status: 500 });
    }

    // Save SocialAccount to database
    // Requirements: 2.13, 2.14, 2.15, 2.16 - Upsert SocialAccount record
    console.log("[GET /api/oauth/instagram/callback] Saving SocialAccount:", {
      userId: user.id,
      platform: "Instagram",
      platformAccountId: sanitizedProfile.id,
      timestamp: new Date().toISOString(),
    });

    const prisma = getPrisma();

    try {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_platformAccountId: {
            userId: user.id,
            platform: "Instagram",
            platformAccountId: sanitizedProfile.id,
          },
        },
        update: {
          platformUsername: sanitizedProfile.username,
          accessToken: encryptedAccessToken,
          refreshToken: null, // Instagram doesn't use refresh tokens
          expiresAt,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          id: crypto.randomUUID(),
          userId: user.id,
          platform: "Instagram",
          platformAccountId: sanitizedProfile.id,
          platformUsername: sanitizedProfile.username,
          accessToken: encryptedAccessToken,
          refreshToken: null, // Instagram doesn't use refresh tokens
          expiresAt,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Requirement: 2.27 - Log successful connection with userId, platform, and timestamp
      console.log("[GET /api/oauth/instagram/callback] SocialAccount saved successfully:", {
        userId: user.id,
        platform: "Instagram",
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      // Requirement: 2.24 - Return HTTP 500 if database save fails
      console.error("[GET /api/oauth/instagram/callback] Database error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: dbError instanceof Error ? dbError.message : "Unknown error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      return NextResponse.json({ error: "Failed to save account connection" }, { status: 500 });
    }

    // Clear CSRF token cookie after successful validation
    // Requirement: 2.4 - Clear CSRF token cookie after validation
    // Requirement: 10.6 - Clear CSRF token after successful validation
    // Requirement: 2.17 - Redirect to settings with success message
    const response = NextResponse.redirect(
      `${appUrl}/settings/social-accounts?success=${encodeURIComponent("Instagram account connected successfully")}`,
    );
    response.cookies.delete("instagram_oauth_state");

    return response;
  } catch (error) {
    // Log errors with user context
    console.error("[GET /api/oauth/instagram/callback] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to complete OAuth callback" }, { status: 500 });
  }
}
