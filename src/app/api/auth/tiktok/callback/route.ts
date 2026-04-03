import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";

/**
 * GET /api/auth/tiktok/callback
 * Handles TikTok OAuth callback, exchanges code for tokens, and stores in database
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      const redirectUrl = new URL(
        "/settings/social-accounts",
        process.env.NEXT_PUBLIC_APP_URL
      );
      redirectUrl.searchParams.set("error", "oauth_denied");
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code || !state) {
      return NextResponse.json(
        { success: false, error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    // Verify CSRF state parameter
    const cookieStore = await cookies();
    const storedState = cookieStore.get("oauth_state_tiktok")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { success: false, error: "Invalid state parameter - CSRF check failed" },
        { status: 400 }
      );
    }

    // Clear the state cookie
    cookieStore.delete("oauth_state_tiktok");

    // Get current user from session
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "not_authenticated");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Exchange authorization code for tokens
    const clientKey = process.env.TikTok_CLIENT_KEY;
    const clientSecret = process.env.TikTok_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

    if (!clientKey || !clientSecret) {
      return NextResponse.json(
        { success: false, error: "TikTok OAuth not configured" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("TikTok token exchange failed:", errorData);
      return NextResponse.json(
        { success: false, error: "Failed to exchange code for tokens" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return NextResponse.json(
        { success: false, error: "No access token received" },
        { status: 500 }
      );
    }

    // Calculate token expiration time
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // Store tokens in database (upsert to handle reconnection)
    const prisma = getPrisma();
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId: user.id,
          platform: "TikTok",
        },
      },
      create: {
        userId: user.id,
        platform: "TikTok",
        accessToken: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
      },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    // Redirect back to social accounts page with success message
    const redirectUrl = new URL(
      "/settings/social-accounts",
      process.env.NEXT_PUBLIC_APP_URL
    );
    redirectUrl.searchParams.set("success", "tiktok_connected");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("TikTok OAuth callback error:", err);
    const redirectUrl = new URL(
      "/settings/social-accounts",
      process.env.NEXT_PUBLIC_APP_URL
    );
    redirectUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
