import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { createSignedToken } from "@/lib/session";

/**
 * GET /api/auth/google-signin/callback
 * Handles Google OAuth callback for user authentication
 * Creates or logs in user based on Google profile, saves to Neon Postgres DB
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      console.error("Google OAuth returned error:", error);
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_denied");
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code || !state) {
      console.error("Missing code or state parameter in callback URL");
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Verify CSRF state parameter
    const cookieStore = await cookies();
    const storedState = cookieStore.get("oauth_signin_state")?.value;

    if (!storedState || storedState !== state) {
      console.error("CSRF state mismatch:", {
        hasStoredState: !!storedState,
        stateMatch: storedState === state,
      });
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Exchange authorization code for tokens
    const clientId = process.env.Google_CLIENT_ID;
    const clientSecret = process.env.Google_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/google-signin/callback`;

    if (!clientId || !clientSecret) {
      console.error("Google OAuth not configured:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    console.log("Exchanging code for tokens with redirect_uri:", redirectUri);

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
      console.error("Google token exchange failed:", {
        status: tokenResponse.status,
        error: errorData,
        redirectUri,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    if (!access_token) {
      console.error("No access_token in Google token response:", tokenData);
      const redirectUrl = new URL("/login", appUrl);
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
      console.error("Failed to fetch user info from Google:", userInfoResponse.status);
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    const userInfo = await userInfoResponse.json();
    const { email, given_name, family_name, picture, name } = userInfo;

    if (!email) {
      console.error("No email in Google user info:", userInfo);
      const redirectUrl = new URL("/login", appUrl);
      redirectUrl.searchParams.set("error", "no_email");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Determine first name and last name from Google profile
    // Google provides given_name, family_name, and also a full "name" field
    const firstName = given_name || (name ? name.split(" ")[0] : "User");
    const lastName = family_name || (name ? name.split(" ").slice(1).join(" ") : "");

    console.log("Google user info retrieved:", { email, firstName, lastName, hasPicture: !!picture });

    // Check if user exists, create if not — saves to Neon Postgres via Prisma
    const prisma = getPrisma();
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user with Google account details
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          profilePic: picture || null,
          emailVerified: new Date(), // Google accounts are pre-verified
          password: null, // No password for OAuth users
        },
      });
      console.log("New user created via Google OAuth:", { id: user.id, email: user.email });
    } else {
      // Update user details if they've changed on Google
      const updateData: Record<string, unknown> = {};

      // Update name if user doesn't have one set (e.g., was a placeholder)
      if (firstName && user.firstName === "User") {
        updateData.firstName = firstName;
      }
      if (lastName && !user.lastName) {
        updateData.lastName = lastName;
      }

      // Mark email as verified if not already
      if (!user.emailVerified) {
        updateData.emailVerified = new Date();
      }

      // Update profile picture if changed (only update Google profile pictures, not custom B2 uploads)
      const isGoogleProfilePic = user.profilePic?.includes('googleusercontent.com') ?? false;
      const shouldUpdatePic = picture && (isGoogleProfilePic || !user.profilePic);
      
      if (shouldUpdatePic && user.profilePic !== picture) {
        updateData.profilePic = picture;
      }

      // Only run update if we have something to update
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        console.log("Existing user updated via Google OAuth:", { id: user.id, updatedFields: Object.keys(updateData) });
      } else {
        console.log("Existing user signed in via Google OAuth:", { id: user.id, email: user.email });
      }
    }

    // Create session token
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error("SESSION_SECRET is not configured");
      throw new Error("SESSION_SECRET not configured");
    }
    
    const sessionToken = createSignedToken(
      {
        sub: user.id,
        email: user.email,
      },
      secret
    );
    
    // Create redirect response to dashboard
    const redirectUrl = new URL("/dashboard", appUrl);
    const response = NextResponse.redirect(redirectUrl.toString());

    // Set session cookie directly on the redirect response
    // This ensures the cookie is included in the 302 redirect
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: true, // Always secure — Vercel always serves over HTTPS
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Clear the state cookie on the same response
    response.cookies.set("oauth_signin_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0, // Immediately expires = deletes the cookie
      path: "/",
    });

    console.log("Google Sign-In successful, redirecting to dashboard for user:", user.email);
    return response;
  } catch (err) {
    console.error("Google Sign-In callback error:", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
    const redirectUrl = new URL("/login", appUrl);
    redirectUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
