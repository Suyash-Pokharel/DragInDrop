import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * GET /api/auth/google-signin
 * Initiates Google OAuth flow for user authentication (Sign In with Google)
 * This is different from /api/auth/google which is for connecting YouTube accounts
 */
export async function GET() {
  try {
    const clientId = process.env.Google_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    // Generate CSRF state parameter
    const state = crypto.randomBytes(32).toString("hex");
    
    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("oauth_signin_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

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
    authUrl.searchParams.set("access_type", "online"); // Don't need refresh token for sign-in
    authUrl.searchParams.set("prompt", "select_account"); // Allow user to select account

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error("Google Sign-In initiation error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
