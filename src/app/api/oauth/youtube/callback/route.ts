import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { encryptToken } from "@/lib/encryption";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps, sanitizeGoogleProfile, validateRedirectUri, sanitizeString } from "@/lib/sanitize";

/**
 * GET /api/oauth/youtube/callback
 * Handles OAuth 2.0 callback from Google for YouTube authorization
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
  } catch {
    console.error("[GET /api/oauth/youtube/callback] Rate limit exceeded:", {
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
    console.error("[GET /api/oauth/youtube/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[GET /api/oauth/youtube/callback] User rate limit exceeded:", {
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

    // Note: OAuth codes and state tokens are cryptographic values that should not be HTML-sanitized
    // They will only be used in server-to-server API calls, never displayed in HTML
    // We only sanitize the error message which might be displayed to users
    const sanitizedError = error ? sanitizeString(error, 200) : null;

    // Handle user authorization denial
    // Requirement: 8.1 - Handle authorization denial
    if (sanitizedError) {
      console.log("[GET /api/oauth/youtube/callback] Authorization denied:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: sanitizedError,
      });
      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Authorization denied")}`
      );
    }

    // Validate authorization code is present
    // Requirement: 8.2 - Return 400 if code is missing
    if (!code) {
      console.error("[GET /api/oauth/youtube/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Verify CSRF token (state parameter)
    // Requirements: 2.2, 2.3, 2.4, 8.2, 10.2, 10.3, 10.4 - Verify state matches CSRF token and hasn't expired
    const storedState = request.cookies.get("youtube_oauth_state")?.value;
    const storedTimestamp = request.cookies.get("youtube_oauth_state_timestamp")?.value;
    
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/youtube/callback] Invalid state parameter:", {
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

    // Validate CSRF token hasn't expired (10 minutes)
    // Requirement: 10.2 - Validate CSRF token hasn't expired
    if (!storedTimestamp) {
      console.error("[GET /api/oauth/youtube/callback] Missing CSRF token timestamp:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    const tokenAge = Date.now() - parseInt(storedTimestamp, 10);
    const maxTokenAge = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (tokenAge > maxTokenAge) {
      console.error("[GET /api/oauth/youtube/callback] CSRF token expired:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        tokenAge: Math.floor(tokenAge / 1000), // in seconds
        maxTokenAge: Math.floor(maxTokenAge / 1000), // in seconds
      });
      return NextResponse.json(
        { error: "Authorization session expired. Please try again." },
        { status: 400 }
      );
    }

    // Validate redirect URI
    // Requirements: 10.10, 10.11 - Validate redirect_uri matches configured value
    const redirectUri = `${appUrl}/api/oauth/youtube/callback`;
    
    // Validate HTTPS in production
    // Requirement: 10.9 - Ensure HTTPS in production
    const isProduction = process.env.NODE_ENV === "production";
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/youtube/callback] Invalid redirect URI protocol:", {
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

    // Validate that redirect_uri matches the expected configured value
    // Requirement: 10.11 - Validate redirect_uri matches configured value
    const expectedRedirectUri = `${appUrl}/api/oauth/youtube/callback`;
    if (!validateRedirectUri(redirectUri, expectedRedirectUri)) {
      console.error("[GET /api/oauth/youtube/callback] Redirect URI mismatch:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        providedUri: redirectUri,
        expectedUri: expectedRedirectUri,
      });
      return NextResponse.json(
        { error: "OAuth configuration error: Redirect URI mismatch" },
        { status: 500 }
      );
    }

    // Validate OAuth configuration
    // Requirement: 8.4 - Return 500 if credentials missing
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GET /api/oauth/youtube/callback] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    // Requirements: 2.5, 2.6, 2.7, 2.8, 2.11 - Token exchange with Google OAuth API
    const tokenUrl = "https://oauth2.googleapis.com/token";

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    console.log("[GET /api/oauth/youtube/callback] Exchanging authorization code:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientId,
      codeLength: code.length,
      tokenUrl,
      requestBody: {
        client_id: clientId,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_preview: code.substring(0, 20) + "...",
      },
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
        console.error("[GET /api/oauth/youtube/callback] Token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      console.error("[GET /api/oauth/youtube/callback] Token exchange network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    } finally {
      clearTimeout(tokenTimeout);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/youtube/callback] Token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        error: errorData,
        errorCode: errorData.error,
        errorDescription: errorData.error_description,
        requestDetails: {
          clientId,
          redirectUri,
          codeLength: code.length,
        },
      });

      // Requirement: 8.6 - Handle rate limit errors from Google API
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
      // Google returns error codes like "redirect_uri_mismatch" or error descriptions
      const errorCode = errorData.error;
      const errorDescription = errorData.error_description;
      
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
      token_type,
    } = tokenData;

    if (!access_token || !refresh_token) {
      console.error("[GET /api/oauth/youtube/callback] Invalid token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    }

    console.log("[GET /api/oauth/youtube/callback] Token exchange successful:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      expiresIn: expires_in,
      tokenType: token_type,
    });

    // Fetch Google user profile
    // Requirements: 2.9, 2.10, 2.12 - Fetch user profile
    console.log("[GET /api/oauth/youtube/callback] Fetching Google profile:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      hasAccessToken: !!access_token,
    });

    const profileUrl = "https://www.googleapis.com/oauth2/v1/userinfo";

    // Requirement: 8.7 - Handle network timeouts with 504 response
    const profileController = new AbortController();
    const profileTimeout = setTimeout(() => profileController.abort(), 10000); // 10 second timeout

    let profileResponse: Response;
    try {
      profileResponse = await fetch(profileUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        signal: profileController.signal,
      });
    } catch (fetchError) {
      clearTimeout(profileTimeout);
      
      // Check if error is due to timeout/abort
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/youtube/callback] Profile fetch timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      console.error("[GET /api/oauth/youtube/callback] Profile fetch network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      // Requirement: 2.12 - Return 500 if profile fetch fails
      return NextResponse.json(
        { error: "Failed to fetch Google profile" },
        { status: 500 }
      );
    } finally {
      clearTimeout(profileTimeout);
    }

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/youtube/callback] Profile fetch failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: profileResponse.status,
        error: errorData,
      });

      // Requirement: 8.6 - Handle rate limit errors from Google API
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

      // Requirement: 2.12 - Return 500 if profile fetch fails
      return NextResponse.json(
        { error: "Failed to fetch Google profile" },
        { status: 500 }
      );
    }

    const profileData = await profileResponse.json();
    
    // Sanitize all user inputs from Google API responses
    // Requirement: 10.10 - Sanitize all user inputs from Google API responses
    const sanitizedProfile = sanitizeGoogleProfile(profileData);
    const { email, name, id: googleUserId } = sanitizedProfile;

    if (!email || !googleUserId) {
      console.error("[GET /api/oauth/youtube/callback] Invalid profile response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasEmail: !!email,
        hasGoogleUserId: !!googleUserId,
      });
      // Requirement: 2.12 - Return 500 if profile fetch fails
      return NextResponse.json(
        { error: "Failed to fetch Google profile" },
        { status: 500 }
      );
    }

    console.log("[GET /api/oauth/youtube/callback] Profile data received and sanitized:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      email,
      name,
      googleUserId,
    });

    // Fetch YouTube channel information to get the channel handle
    console.log("[GET /api/oauth/youtube/callback] Fetching YouTube channel info:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    let youtubeChannelUsername = email; // Fallback to email if channel fetch fails

    try {
      // Request both snippet (for title) and brandingSettings (for customUrl/handle)
      const channelUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&mine=true";
      
      const channelController = new AbortController();
      const channelTimeout = setTimeout(() => channelController.abort(), 10000);

      const channelResponse = await fetch(channelUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        signal: channelController.signal,
      });

      clearTimeout(channelTimeout);

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        
        if (channelData.items && channelData.items.length > 0) {
          const channel = channelData.items[0];
          
          // Priority: customUrl (handle) > title > email
          // customUrl is the @handle format (e.g., @YourChannelName)
          const customUrl = channel.snippet?.customUrl;
          const channelTitle = channel.snippet?.title;
          
          if (customUrl) {
            // customUrl already includes @ prefix
            youtubeChannelUsername = sanitizeString(customUrl, 100);
            console.log("[GET /api/oauth/youtube/callback] YouTube channel handle fetched:", {
              userId: user.id,
              timestamp: new Date().toISOString(),
              channelHandle: youtubeChannelUsername,
            });
          } else if (channelTitle) {
            // Fallback to title if no custom URL/handle set
            youtubeChannelUsername = sanitizeString(channelTitle, 100);
            console.log("[GET /api/oauth/youtube/callback] YouTube channel title fetched (no handle):", {
              userId: user.id,
              timestamp: new Date().toISOString(),
              channelTitle: youtubeChannelUsername,
            });
          } else {
            console.warn("[GET /api/oauth/youtube/callback] No channel handle or title found, using email:", {
              userId: user.id,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          console.warn("[GET /api/oauth/youtube/callback] No YouTube channel found, using email:", {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        console.warn("[GET /api/oauth/youtube/callback] YouTube channel fetch failed, using email:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          status: channelResponse.status,
        });
      }
    } catch (channelError) {
      // Non-critical error - we'll use email as fallback
      console.warn("[GET /api/oauth/youtube/callback] YouTube channel fetch error, using email:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: channelError instanceof Error ? channelError.message : "Unknown error",
      });
    }

    // Calculate token expiration timestamp
    // Requirement: 3.1 - Add expires_in seconds to current time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    console.log("[GET /api/oauth/youtube/callback] Token expiration calculated:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      expiresIn: expires_in,
      expiresAt: expiresAt.toISOString(),
    });

    // Encrypt tokens before storage
    // Requirements: 9.2, 9.3, 10.5, 10.6, 10.14
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;

    try {
      encryptedAccessToken = encryptToken(access_token);
      encryptedRefreshToken = encryptToken(refresh_token);

      console.log("[GET /api/oauth/youtube/callback] Tokens encrypted successfully:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (encryptionError) {
      // Requirement: 10.14 - Log encryption errors without logging plaintext tokens
      console.error("[GET /api/oauth/youtube/callback] Token encryption failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: encryptionError instanceof Error ? encryptionError.message : "Unknown encryption error",
      });

      return NextResponse.json(
        { error: "Failed to save account connection" },
        { status: 500 }
      );
    }

    // Create or update SocialAccount record
    // Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11
    // Requirements: 8.9, 8.10 - Handle duplicate OAuth requests with upsert and unique constraints
    // The upsert operation is atomic and uses the unique constraint (userId, platform, platformAccountId)
    // This ensures that:
    // - If the user already has a connected YouTube account, it updates the existing record with new tokens
    // - Concurrent OAuth requests are handled safely without creating duplicate records
    // - Database transactions with unique constraints prevent race conditions
    console.log("[GET /api/oauth/youtube/callback] Saving SocialAccount:", {
      userId: user.id,
      platform: "YouTube",
      platformAccountId: googleUserId,
      timestamp: new Date().toISOString(),
    });

    try {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_platformAccountId: {
            userId: user.id,
            platform: "YouTube",
            platformAccountId: googleUserId,
          },
        },
        update: {
          platformUsername: youtubeChannelUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
        },
        create: {
          id: crypto.randomUUID(),
          userId: user.id,
          platform: "YouTube",
          platformAccountId: googleUserId,
          platformUsername: youtubeChannelUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("[GET /api/oauth/youtube/callback] SocialAccount saved successfully:", {
        userId: user.id,
        platform: "YouTube",
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      // Requirement: 3.13 - Handle database errors
      console.error("[GET /api/oauth/youtube/callback] Database error:", {
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

    // Clear CSRF token and timestamp after successful validation
    // Requirements: 10.3, 10.4 - Clear CSRF token after successful validation
    // Requirement: 3.12 - Redirect to social accounts page with success message
    const response = NextResponse.redirect(
      `${appUrl}/settings/social-accounts?success=true`
    );
    response.cookies.delete("youtube_oauth_state");
    response.cookies.delete("youtube_oauth_state_timestamp");

    return response;
  } catch (error) {
    // Requirement: 8.8 - Log errors with user context
    console.error("[GET /api/oauth/youtube/callback] Unexpected error:", {
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
