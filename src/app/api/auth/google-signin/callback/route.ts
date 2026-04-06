import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { createSignedToken, verifySignedToken } from "@/lib/session";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://suyash-pokharel.com.np" : "http://localhost:3000")).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Log received parameters for debugging
  console.log("[OAuth Callback] Received parameters:", {
    hasCode: !!code,
    codePrefix: code?.substring(0, 10),
    hasState: !!state,
    statePrefix: state?.substring(0, 10),
    error: error || "none",
  });

  if (error) {
    console.error("[OAuth Callback] OAuth error from Google:", error);
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=${error}`);
  }

  if (!code || !state) {
    console.error("[OAuth Callback] Missing code or state parameter");
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=no_code_or_state`);
  }

  // Verify CSRF state
  const storedState = req.cookies.get("oauth_signin_state")?.value;
  console.log("[OAuth Callback] CSRF state validation:", {
    hasStoredState: !!storedState,
    storedStatePrefix: storedState?.substring(0, 10),
    statesMatch: storedState === state,
  });

  if (!storedState || storedState !== state) {
    console.error("[OAuth Callback] CSRF validation failed - state mismatch");
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=csrf_validation_failed`);
  }

  try {
    // 1. Exchange code for tokens
    const redirectUri = `${APP_URL}/api/auth/google-signin/callback`;
    console.log("[OAuth Callback] Token exchange request:", {
      redirectUri,
      hasClientId: !!GOOGLE_CLIENT_ID,
      hasClientSecret: !!GOOGLE_CLIENT_SECRET,
      codePrefix: code.substring(0, 10),
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    console.log("[OAuth Callback] Token exchange response:", {
      success: !tokens.error,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      error: tokens.error || "none",
      errorDescription: tokens.error_description || "none",
    });

    if (tokens.error) {
      console.error("[OAuth Callback] Token exchange failed:", {
        error: tokens.error,
        errorDescription: tokens.error_description,
        errorUri: tokens.error_uri,
      });
      return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=token_failed`);
    }

    // 2. Fetch User Info to identify who this account belongs to
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userResponse.json();

    console.log("[OAuth Callback] User info fetch response:", {
      success: !!googleUser.email,
      hasEmail: !!googleUser.email,
      emailDomain: googleUser.email?.split("@")[1],
      hasGivenName: !!googleUser.given_name,
      hasFamilyName: !!googleUser.family_name,
      hasPicture: !!googleUser.picture,
      error: googleUser.error || "none",
    });

    if (googleUser.error) {
      console.error("[OAuth Callback] User info fetch failed:", {
        error: googleUser.error,
        errorDescription: googleUser.error_description,
      });
      return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=user_info_failed`);
    }

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
      console.log("[OAuth Callback] Creating or updating user:", {
        email: googleUser.email,
        hasGivenName: !!googleUser.given_name,
        hasFamilyName: !!googleUser.family_name,
      });

      try {
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

        console.log("[OAuth Callback] User created/updated successfully:", {
          userId: user.id,
          email: user.email,
        });

        // Log the user in securely
        const secret = process.env.SESSION_SECRET;
        if (secret) {
          sessionTokenToSet = createSignedToken({ sub: userId, email: user.email }, secret);
          console.log("[OAuth Callback] Session token created for new user");
        } else {
          console.warn("[OAuth Callback] SESSION_SECRET is missing, cannot log in user");
        }
      } catch (dbError) {
        console.error("[OAuth Callback] Database error during user creation:", {
          error: dbError instanceof Error ? dbError.message : "Unknown error",
          email: googleUser.email,
        });
        return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=database_error`);
      }
    }

    // 4. Save/Update Social Account Connection
    console.log("[OAuth Callback] Saving social account connection:", {
      userId,
      platform: "google",
      username: googleUser.email,
    });

    try {
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

      console.log("[OAuth Callback] Social account connection saved successfully");
    } catch (dbError) {
      console.error("[OAuth Callback] Database error during social account save:", {
        error: dbError instanceof Error ? dbError.message : "Unknown error",
        userId,
        platform: "google",
      });
      return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=database_error`);
    }

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
      console.log("[OAuth Callback] Session cookie set successfully");
    }

    console.log("[OAuth Callback] OAuth flow completed successfully, redirecting to dashboard");
    return response;
  } catch (err) {
    console.error("[OAuth Callback] Unexpected error during OAuth callback:", {
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.redirect(`${APP_URL}/dashboard?auth_error=server_error`);
  }
}
