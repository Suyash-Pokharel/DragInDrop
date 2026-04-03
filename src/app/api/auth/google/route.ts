import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's authorization URL
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
    cookieStore.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build Google OAuth authorization URL
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const scope = [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline"); // Request refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error("Google OAuth initiation error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
