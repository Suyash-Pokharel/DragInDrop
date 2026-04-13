import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps } from "@/lib/sanitize";

/**
 * GET /api/oauth/youtube/authorize
 * Initiates YouTube OAuth 2.0 authorization flow
 * Requirements: 1.1, 8.3, 10.13
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
    console.error("[GET /api/oauth/youtube/authorize] Rate limit exceeded:", {
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
    console.error("[GET /api/oauth/youtube/authorize] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch (rateLimitError) {
    console.error("[GET /api/oauth/youtube/authorize] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // Validate OAuth configuration
    // Requirement: 8.4 - Return 500 if credentials missing
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret) {
      console.error("[GET /api/oauth/youtube/authorize] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    // Generate cryptographically secure CSRF token with timestamp
    // Requirements: 1.2, 10.1, 10.2 - Generate secure random CSRF token with expiration
    const csrfToken = randomBytes(32).toString("hex");
    const csrfTimestamp = Date.now().toString();

    // Construct YouTube authorization URL
    // Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 10.9
    const redirectUri = `${appUrl}/api/oauth/youtube/callback`;
    
    // Validate HTTPS in production
    // Requirement: 10.9 - Ensure HTTPS in production
    const isProduction = process.env.NODE_ENV === "production";
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/youtube/authorize] Invalid redirect URI protocol:", {
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
    
    // YouTube-specific scopes
    // Requirement: 1.5 - Use YouTube-specific scopes
    const scope = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
    const responseType = "code";
    const accessType = "offline"; // To receive refresh token
    const prompt = "consent"; // Force consent screen to ensure refresh token

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", responseType);
    authUrl.searchParams.set("state", csrfToken);
    authUrl.searchParams.set("access_type", accessType);
    authUrl.searchParams.set("prompt", prompt);

    // Log authorization initiation
    console.log("[GET /api/oauth/youtube/authorize] Authorization initiated:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientId,
    });

    // Create response with redirect
    // Requirement: 1.9 - Redirect user to Google authorization page
    const response = NextResponse.redirect(authUrl.toString());

    // Store CSRF token and timestamp in secure cookies with 10-minute expiration
    // Requirements: 1.3, 10.2 - Store CSRF token with expiration
    const maxAge = 10 * 60; // 10 minutes in seconds
    response.cookies.set("youtube_oauth_state", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    response.cookies.set("youtube_oauth_state_timestamp", csrfTimestamp, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    // Requirement: 8.8 - Log errors with user context
    console.error("[GET /api/oauth/youtube/authorize] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to initiate authorization" },
      { status: 500 }
    );
  }
}
