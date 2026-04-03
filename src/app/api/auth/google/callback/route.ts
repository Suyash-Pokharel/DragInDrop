import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import {
  getCurrentUserFromToken,
  extractSessionFromCookieHeader,
} from "@/lib/getCurrentUser";

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback, exchanges code for tokens, and stores in database
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
    const storedState = cookieStore.get("oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { success: false, error: "Invalid state parameter - CSRF check failed" },
        { status: 400 }
      );
    }

    // Clear the state cookie
    cookieStore.delete("oauth_state");

    // Get current user from session
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "not_authenticated");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Exchange authorization code for tokens
    const clientId = process.env.Google_CLIENT_ID;
    const clientSecret = process.env.Google_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Google token exchange failed:", errorData);
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
          platform: "Google",
        },
      },
      create: {
        userId: user.id,
        platform: "Google",
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
    redirectUrl.searchParams.set("success", "google_connected");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const redirectUrl = new URL(
      "/settings/social-accounts",
      process.env.NEXT_PUBLIC_APP_URL
    );
    redirectUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
