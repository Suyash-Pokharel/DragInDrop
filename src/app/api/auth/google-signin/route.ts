import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/auth/google-signin
 * Initiates Google OAuth flow for user authentication (Sign In with Google)
 * This is different from /api/auth/google which is for connecting YouTube accounts
 */
export async function GET() {
  try {
    const clientId = process.env.Google_CLIENT_ID;
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId) {
      console.error("Google OAuth not configured: Google_CLIENT_ID is missing");
      return NextResponse.json(
        { success: false, error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    // Remove trailing slash to ensure exact redirect_uri match
    if (appUrl?.endsWith('/')) {
      appUrl = appUrl.slice(0, -1);
    }

    // Generate CSRF state parameter
    const state = crypto.randomBytes(32).toString("hex");

    // Build Google OAuth authorization URL for Sign In
    const redirectUri = `${appUrl}/api/auth/google-signin/callback`;
    const scope = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("prompt", "select_account");

    // Create redirect response and set the state cookie ON the response object
    // This ensures the cookie is included in the 302 redirect response
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set("oauth_signin_state", state, {
      httpOnly: true,
      secure: true, // Always secure — Vercel always serves over HTTPS
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    console.log("Google Sign-In initiated, redirecting to Google with redirect_uri:", redirectUri);
    return response;
  } catch (err) {
    console.error("Google Sign-In initiation error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
