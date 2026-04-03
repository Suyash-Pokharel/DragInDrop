import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { createSignedToken } from "@/lib/session";
import crypto from "crypto";

/**
 * GET /api/auth/google-signin/callback
 * Handles Google OAuth callback for user authentication
 * Creates or logs in user based on Google profile
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
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
    const storedState = cookieStore.get("oauth_signin_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { success: false, error: "Invalid state parameter - CSRF check failed" },
        { status: 400 }
      );
    }

    // Clear the state cookie
    cookieStore.delete("oauth_signin_state");

    // Exchange authorization code for tokens
    const clientId = process.env.Google_CLIENT_ID;
    const clientSecret = process.env.Google_CLIENT_SECRET;
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    // Remove trailing slash to ensure exact redirect_uri match
    if (appUrl?.endsWith('/')) {
      appUrl = appUrl.slice(0, -1);
    }
    
    const redirectUri = `${appUrl}/api/auth/google-signin/callback`;

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
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    if (!access_token) {
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      console.error("Failed to fetch user info from Google");
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    const userInfo = await userInfoResponse.json();
    const { email, given_name, family_name, picture } = userInfo;

    if (!email) {
      const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "no_email");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Check if user exists, create if not
    const prisma = getPrisma();
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user with Google account
      user = await prisma.user.create({
        data: {
          email,
          firstName: given_name || "User",
          lastName: family_name || "",
          profilePic: picture || null,
          emailVerified: new Date(), // Google accounts are pre-verified
          password: null, // No password for OAuth users
        },
      });
    } else {
      // Update profile picture if changed
      if (picture && user.profilePic !== picture) {
        await prisma.user.update({
          where: { id: user.id },
          data: { profilePic: picture },
        });
      }
    }

    // Create session token
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error("SESSION_SECRET not configured");
    }
    
    const sessionToken = createSignedToken(
      {
        sub: user.id,
        email: user.email,
      },
      secret
    );
    
    // Set session cookie
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Redirect to dashboard
    const redirectUrl = new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google Sign-In callback error:", err);
    const redirectUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
