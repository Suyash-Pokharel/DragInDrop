import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * GET /api/auth/tiktok
 * Initiates TikTok OAuth flow by redirecting to TikTok's authorization URL
 */
export async function GET() {
  try {
    const clientKey = process.env.TikTok_CLIENT_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientKey) {
      return NextResponse.json(
        { success: false, error: "TikTok OAuth not configured" },
        { status: 500 }
      );
    }

    // Generate CSRF state parameter
    const state = crypto.randomBytes(32).toString("hex");
    
    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("oauth_state_tiktok", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build TikTok OAuth authorization URL
    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;
    const scope = "user.info.basic,video.list,video.upload";

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error("TikTok OAuth initiation error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
