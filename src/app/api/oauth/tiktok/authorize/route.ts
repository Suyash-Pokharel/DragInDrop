import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps } from "@/lib/sanitize";

/**
 * GET /api/oauth/tiktok/authorize
 * Initiates TikTok OAuth 2.0 authorization flow
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
    console.error("[GET /api/oauth/tiktok/authorize] Rate limit exceeded:", {
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
    console.error("[GET /api/oauth/tiktok/authorize] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch (rateLimitError) {
    console.error("[GET /api/oauth/tiktok/authorize] User rate limit exceeded:", {
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
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientKey || !clientSecret) {
      console.error("[GET /api/oauth/tiktok/authorize] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    // Generate cryptographically secure CSRF token
    // Requirements: 1.2, 10.1 - Generate secure random CSRF token
    const csrfToken = randomBytes(32).toString("hex");

    // Generate PKCE code_verifier and code_challenge
    // TikTok requires PKCE for OAuth 2.0 authorization
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Construct TikTok authorization URL
    // Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 10.9
    const redirectUri = `${appUrl}/api/oauth/tiktok/callback`;
    
    // Validate HTTPS in production
    // Requirement: 10.9 - Ensure HTTPS in production
    const isProduction = process.env.NODE_ENV === "production";
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/tiktok/authorize] Invalid redirect URI protocol:", {
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
    
    const scope = "user.info.basic,video.upload,video.publish";
    const responseType = "code";

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", responseType);
    authUrl.searchParams.set("state", csrfToken);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Log authorization initiation with FULL details
    console.log("[GET /api/oauth/tiktok/authorize] Authorization initiated:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientKey,
      fullAuthUrl: authUrl.toString(),
    });

    // Create response with redirect
    // Requirement: 1.8 - Redirect user to TikTok authorization page
    const response = NextResponse.redirect(authUrl.toString());

    // Store CSRF token in secure cookie with 10-minute expiration
    // Requirements: 1.3, 10.2 - Store CSRF token with expiration
    const maxAge = 10 * 60; // 10 minutes in seconds
    response.cookies.set("tiktok_oauth_state", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    // Store PKCE code_verifier in secure cookie for callback verification
    response.cookies.set("tiktok_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    // Requirement: 8.8 - Log errors with user context
    console.error("[GET /api/oauth/tiktok/authorize] Unexpected error:", {
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
