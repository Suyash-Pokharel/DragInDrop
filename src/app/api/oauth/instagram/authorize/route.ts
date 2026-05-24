import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps } from "@/lib/sanitize";

/**
 * GET /api/oauth/instagram/authorize
 * Initiates Instagram OAuth 2.0 authorization flow
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  // Apply per-IP rate limiting (10 requests per 15 minutes)
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[GET /api/oauth/instagram/authorize] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  // Authenticate user
  // Return HTTP 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/instagram/authorize] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  // Apply per-user rate limiting (5 requests per 15 minutes)
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[GET /api/oauth/instagram/authorize] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  try {
    // Validate OAuth configuration
    // Return HTTP 500 if credentials missing
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appId || !appSecret) {
      console.error("[GET /api/oauth/instagram/authorize] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET",
      });
      return NextResponse.json({ error: "OAuth configuration error" }, { status: 500 });
    }

    // Generate cryptographically secure CSRF token
    // Generate cryptographically secure 32-byte CSRF token
    const csrfToken = randomBytes(32).toString("hex");

    // Construct Instagram OAuth authorization URL
    const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

    // Validate HTTPS in production
    // Validate redirect_uri uses HTTPS in production
    const isProduction = process.env.NODE_ENV === "production";
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/instagram/authorize] Invalid redirect URI protocol:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        redirectUri,
        isProduction,
      });
      return NextResponse.json(
        { error: "OAuth configuration error: HTTPS required in production" },
        { status: 500 },
      );
    }

    // Instagram OAuth parameters
    // Set scopes for Instagram Business/Creator accounts
    // Core scopes: basic profile access and content publishing
    // Optional scopes: messages, comments, insights (add as needed)
    const scope =
      "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights";
    const responseType = "code";

    // Construct Instagram OAuth authorization URL
    // Using Instagram API with Instagram Login (new endpoint as of July 2024)
    const authUrl = new URL("https://www.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", responseType);
    authUrl.searchParams.set("state", csrfToken);
    // Optional: force re-authentication to ensure fresh consent
    authUrl.searchParams.set("force_reauth", "true");

    // Log authorization initiation with userId and timestamp
    // Log authorization initiation with userId and timestamp
    console.log("[GET /api/oauth/instagram/authorize] Authorization initiated:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      appId,
    });

    // Create response with redirect
    // Redirect user to Instagram authorization URL
    const response = NextResponse.redirect(authUrl.toString());

    // Store CSRF token in httpOnly cookie with 10-minute expiration
    // Store CSRF token in httpOnly cookie with 10-minute expiration
    const maxAge = 10 * 60; // 10 minutes in seconds
    response.cookies.set("instagram_oauth_state", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    // Log errors with user context
    console.error("[GET /api/oauth/instagram/authorize] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to initiate authorization" }, { status: 500 });
  }
}
