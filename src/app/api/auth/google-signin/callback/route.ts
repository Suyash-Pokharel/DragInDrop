import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { createSignedToken, verifySignedToken } from "@/lib/session";

const GOOGLE_CLIENT_ID = process.env.Google_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.Google_CLIENT_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://suyash-pokharel.com.np" : "http://localhost:3000")).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=no_code_or_state`);
  }

  // Verify CSRF state
  const storedState = req.cookies.get("oauth_signin_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=csrf_validation_failed`);
  }

  try {
    // 1. Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${APP_URL}/api/auth/google-signin/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Token error:", tokens);
      return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=token_failed`);
    }

    // 2. Fetch User Info to identify who this account belongs to
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userResponse.json();

    // 3. Identify local user (either log them in OR connect to existing session)
    const cookie = req.cookies.get("session")?.value;
    let userId: string | null = null;

    if (cookie) {
      const payload = verifySignedToken(cookie);
      userId = payload?.sub || null;
    }

    const prisma = getPrisma();
    let sessionTokenToSet: string | null = null;

    // If no session, find/create user by email
    if (!userId) {
      const user = await prisma.user.upsert({
        where: { email: googleUser.email },
        update: {
          firstName: googleUser.given_name || "",
          lastName: googleUser.family_name || "",
          profilePic: googleUser.picture,
        },
        create: {
          email: googleUser.email,
          firstName: googleUser.given_name || "",
          lastName: googleUser.family_name || "",
          profilePic: googleUser.picture,
          emailVerified: new Date(),
        },
      });
      userId = user.id;

      // Log the user in securely
      const secret = process.env.SESSION_SECRET;
      if (secret) {
        sessionTokenToSet = createSignedToken({ sub: userId, email: user.email }, secret);
      } else {
        console.warn("SESSION_SECRET is missing, cannot log in user");
      }
    }

    // 4. Save/Update Social Account Connection
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId: userId!,
          platform: "google",
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token, // Refresh token is only sent on first consent
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        username: googleUser.email,
        avatarUrl: googleUser.picture,
      },
      create: {
        userId: userId!,
        platform: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        username: googleUser.email,
        avatarUrl: googleUser.picture,
      },
    });

    const response = NextResponse.redirect(`${APP_URL}/dashboard?auth_success=google`);
    
    // Clear CSRF state
    response.cookies.delete("oauth_signin_state");

    // Persist session if we generated a new one
    if (sessionTokenToSet) {
      const secure = process.env.NODE_ENV === "production";
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      response.cookies.set("session", sessionTokenToSet, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge,
      });
    }

    return response;
  } catch (err) {
    console.error("OAuth Callback Error:", err);
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=server_error`);
  }
}
