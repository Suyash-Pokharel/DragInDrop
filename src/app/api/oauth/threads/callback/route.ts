import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { encryptToken } from "@/lib/encryption";
import { sanitizeThreadsProfile } from "@/lib/sanitize";
import { getPrisma } from "@/lib/prisma";
import { createNotification, formatSocialAccountConnected } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

/**
 * GET /api/oauth/threads/callback
 * Handles OAuth 2.0 callback from Threads for account authorization
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  //  Return HTTP 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/threads/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Extract query parameters
    //  Extract authorization code and state parameter from query string
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // Handle user authorization denial
    //  Handle user denial: if error=access_denied, redirect to settings
    if (error) {
      console.log("[GET /api/oauth/threads/callback] Authorization denied:", {
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
    //  Return HTTP 400 if code missing
    if (!code) {
      console.error("[GET /api/oauth/threads/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Retrieve CSRF token from cookie
    //  Retrieve CSRF token from httpOnly cookie
    const storedState = request.cookies.get("threads_oauth_state")?.value;

    // Validate state parameter matches stored CSRF token
    //  Validate state parameter matches stored CSRF token
    //  Return HTTP 400 if state invalid
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/threads/callback] Invalid state parameter:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        stateProvided: !!state,
        stateStored: !!storedState,
        stateMatch: state === storedState,
      });
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    // Validate CSRF token has not expired (10-minute window)
    // Note: Cookie expiration is handled by the browser. If the cookie exists, it's within the 10-minute window.
    // The cookie was set with maxAge=600 (10 minutes) in the authorize endpoint.
    // If we reach this point with a valid cookie, the token hasn't expired.

    // Log CSRF token validation success
    console.log("[GET /api/oauth/threads/callback] CSRF token validated successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      codeLength: code.length,
    });

    // Implement short-lived token exchange (Step 1)
    const threadsAppId = process.env.THREADS_APP_ID;
    const threadsAppSecret = process.env.THREADS_APP_SECRET;
    const redirectUri = `${appUrl}/api/oauth/threads/callback`;

    if (!threadsAppId || !threadsAppSecret) {
      console.error("[GET /api/oauth/threads/callback] Missing Threads OAuth credentials:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "OAuth configuration error" }, { status: 500 });
    }

    // Exchange authorization code for short-lived token
    //  POST to https://graph.threads.net/oauth/access_token
    let shortLivedToken: string;
    let threadsUserId: string;

    try {
      // Create abort controller for 10-second timeout
      //  Set 10-second timeout for request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      //  Include client_id, client_secret, grant_type, redirect_uri, code
      const tokenExchangeUrl = "https://graph.threads.net/oauth/access_token";
      const tokenExchangeBody = new URLSearchParams({
        client_id: threadsAppId,
        client_secret: threadsAppSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code,
      });

      const tokenResponse = await fetch(tokenExchangeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenExchangeBody.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      //  Return HTTP 500 on exchange failure
      if (!tokenResponse.ok) {
        console.error("[GET /api/oauth/threads/callback] Short-lived token exchange failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
        });
        return NextResponse.json(
          { error: "Failed to exchange authorization code" },
          { status: 500 },
        );
      }

      //  Extract access_token and user_id from response
      const tokenData = await tokenResponse.json();
      shortLivedToken = tokenData.access_token;
      threadsUserId = tokenData.user_id;

      if (!shortLivedToken || !threadsUserId) {
        console.error("[GET /api/oauth/threads/callback] Missing fields in token response:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          hasAccessToken: !!shortLivedToken,
          hasUserId: !!threadsUserId,
        });
        return NextResponse.json(
          { error: "Failed to exchange authorization code" },
          { status: 500 },
        );
      }

      console.log("[GET /api/oauth/threads/callback] Short-lived token obtained successfully:", {
        userId: user.id,
        threadsUserId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      //  Return HTTP 504 on timeout
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[GET /api/oauth/threads/callback] Short-lived token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }

      //  Return HTTP 500 on exchange failure
      console.error("[GET /api/oauth/threads/callback] Short-lived token exchange error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json({ error: "Failed to exchange authorization code" }, { status: 500 });
    }

    //  Implement long-lived token exchange (Step 2)
    let longLivedToken: string;
    let tokenExpiresIn: number;

    try {
      // Create abort controller for 10-second timeout
      //  Set 10-second timeout for request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Exchange short-lived token for long-lived token
      //  GET to https://graph.threads.net/access_token?grant_type=th_exchange_token
      const longLivedTokenUrl = new URL("https://graph.threads.net/access_token");
      longLivedTokenUrl.searchParams.append("grant_type", "th_exchange_token");
      longLivedTokenUrl.searchParams.append("client_secret", threadsAppSecret);
      longLivedTokenUrl.searchParams.append("access_token", shortLivedToken);

      const longLivedTokenResponse = await fetch(longLivedTokenUrl.toString(), {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      //  Return HTTP 500 on exchange failure
      if (!longLivedTokenResponse.ok) {
        console.error("[GET /api/oauth/threads/callback] Long-lived token exchange failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          status: longLivedTokenResponse.status,
          statusText: longLivedTokenResponse.statusText,
        });
        return NextResponse.json(
          { error: "Failed to exchange for long-lived token" },
          { status: 500 },
        );
      }

      //  Extract access_token, token_type, expires_in from response
      // NOTE: Threads does NOT provide refresh_token
      const longLivedTokenData = await longLivedTokenResponse.json();
      longLivedToken = longLivedTokenData.access_token;
      tokenExpiresIn = longLivedTokenData.expires_in;

      if (!longLivedToken || !tokenExpiresIn) {
        console.error(
          "[GET /api/oauth/threads/callback] Missing fields in long-lived token response:",
          {
            userId: user.id,
            timestamp: new Date().toISOString(),
            hasAccessToken: !!longLivedToken,
            hasExpiresIn: !!tokenExpiresIn,
          },
        );
        return NextResponse.json(
          { error: "Failed to exchange for long-lived token" },
          { status: 500 },
        );
      }

      //  Calculate expiration timestamp as current_time + expires_in seconds (~60 days)
      const expiresAt = new Date(Date.now() + tokenExpiresIn * 1000);

      console.log("[GET /api/oauth/threads/callback] Long-lived token obtained successfully:", {
        userId: user.id,
        threadsUserId,
        expiresIn: tokenExpiresIn,
        expiresAt: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      //  Fetch profile and save account

      // Fetch Threads user profile
      //  GET to https://graph.threads.net/v1.0/me?fields=id,username,name
      let profileData: { id: string; username: string; name: string };

      try {
        // Create abort controller for 10-second timeout
        //  Set 10-second timeout for profile fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const profileUrl = new URL("https://graph.threads.net/v1.0/me");
        profileUrl.searchParams.append("fields", "id,username,name");
        profileUrl.searchParams.append("access_token", longLivedToken);

        const profileResponse = await fetch(profileUrl.toString(), {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        //  Return HTTP 500 on profile fetch failure
        if (!profileResponse.ok) {
          console.error("[GET /api/oauth/threads/callback] Profile fetch failed:", {
            userId: user.id,
            timestamp: new Date().toISOString(),
            status: profileResponse.status,
            statusText: profileResponse.statusText,
          });
          return NextResponse.json({ error: "Failed to fetch Threads profile" }, { status: 500 });
        }

        //  Extract id, username, name from profile response
        const rawProfile = await profileResponse.json();

        //  Sanitize all user inputs from Threads API response
        profileData = sanitizeThreadsProfile(rawProfile);

        if (!profileData.id || !profileData.username) {
          console.error("[GET /api/oauth/threads/callback] Missing required profile fields:", {
            userId: user.id,
            timestamp: new Date().toISOString(),
            hasId: !!profileData.id,
            hasUsername: !!profileData.username,
          });
          return NextResponse.json({ error: "Failed to fetch Threads profile" }, { status: 500 });
        }

        console.log("[GET /api/oauth/threads/callback] Profile fetched successfully:", {
          userId: user.id,
          threadsUserId: profileData.id,
          username: profileData.username,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Handle timeout
        if (error instanceof Error && error.name === "AbortError") {
          console.error("[GET /api/oauth/threads/callback] Profile fetch timeout:", {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
          return NextResponse.json({ error: "Request timeout" }, { status: 504 });
        }

        //  Return HTTP 500 on profile fetch failure
        console.error("[GET /api/oauth/threads/callback] Profile fetch error:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({ error: "Failed to fetch Threads profile" }, { status: 500 });
      }

      // Encrypt the long-lived access token
      //  Encrypt long-lived access_token using AES-256-GCM
      let encryptedAccessToken: string;
      try {
        encryptedAccessToken = encryptToken(longLivedToken);
        console.log("[GET /api/oauth/threads/callback] Token encrypted successfully:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[GET /api/oauth/threads/callback] Token encryption failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json({ error: "Failed to save account connection" }, { status: 500 });
      }

      // Upsert SocialAccount record
      //  Upsert SocialAccount record with platform="Threads", refreshToken=NULL
      try {
        const prisma = getPrisma();

        await prisma.socialAccount.upsert({
          where: {
            userId_platform_platformAccountId: {
              userId: user.id,
              platform: "Threads",
              platformAccountId: profileData.id,
            },
          },
          update: {
            platformUsername: profileData.username,
            accessToken: encryptedAccessToken,
            refreshToken: null, // Threads doesn't use refresh tokens
            expiresAt: expiresAt,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            platform: "Threads",
            platformAccountId: profileData.id,
            platformUsername: profileData.username,
            accessToken: encryptedAccessToken,
            refreshToken: null, // Threads doesn't use refresh tokens
            expiresAt: expiresAt,
            isActive: true,
          },
        });

        console.log("[GET /api/oauth/threads/callback] SocialAccount saved successfully:", {
          userId: user.id,
          platform: "Threads",
          platformAccountId: profileData.id,
          platformUsername: profileData.username,
          timestamp: new Date().toISOString(),
        });

        // Create notification for successful account connection
        try {
          const { title, description } = formatSocialAccountConnected(
            "Threads",
            profileData.username
          );
          await createNotification(
            user.id,
            title,
            description,
            NotificationType.SOCIAL_ACCOUNT_CONNECTED
          );
          console.log("[GET /api/oauth/threads/callback] Notification created successfully:", {
            userId: user.id,
            platform: "Threads",
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          // Log error but don't fail OAuth flow
          console.error("[GET /api/oauth/threads/callback] Notification creation failed:", {
            userId: user.id,
            platform: "Threads",
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      } catch (error) {
        //  Return HTTP 500 on database save failure
        console.error("[GET /api/oauth/threads/callback] Database save failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({ error: "Failed to save account connection" }, { status: 500 });
      }

      // Clear CSRF token cookie after successful validation
      //  Clear CSRF token cookie after successful validation
      const response = NextResponse.redirect(
        `${appUrl}/settings/social-accounts?success=${encodeURIComponent("Threads account connected successfully")}`,
      );
      response.cookies.delete("threads_oauth_state");

      //  Redirect to settings page with success message
      //  Log successful connection with userId, platform, and timestamp
      console.log("[GET /api/oauth/threads/callback] OAuth callback completed successfully:", {
        userId: user.id,
        platform: "Threads",
        platformAccountId: profileData.id,
        platformUsername: profileData.username,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      //  Return HTTP 504 on timeout
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[GET /api/oauth/threads/callback] Long-lived token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }

      //  Return HTTP 500 on exchange failure
      console.error("[GET /api/oauth/threads/callback] Long-lived token exchange error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        { error: "Failed to exchange for long-lived token" },
        { status: 500 },
      );
    }
  } catch (error) {
    // Log errors with user context
    console.error("[GET /api/oauth/threads/callback] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to complete OAuth callback" }, { status: 500 });
  }
}
