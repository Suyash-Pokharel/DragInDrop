import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verifySignedToken } from "@/lib/session";
import {
  getGoogleAuthorizationUrl,
} from "@/lib/oauth/google";
import {
  getTikTokAuthorizationUrl,
  generatePKCE,
} from "@/lib/oauth/tiktok";

const SUPPORTED_PLATFORMS = ["youtube", "tiktok"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * GET /api/social-accounts/connect/[platform]
 *
 * Initiates the OAuth 2.0 authorization flow for the given platform.
 * Steps:
 *  1. Validate the session (user must be logged in).
 *  2. Generate a random `state` string (CSRF protection).
 *  3. For TikTok: also generate PKCE code_verifier + code_challenge.
 *  4. Store state (and PKCE verifier) in a short-lived HttpOnly cookie.
 *  5. Redirect the user to the platform's consent screen.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  // Validate platform
  if (!SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform)) {
    return NextResponse.json(
      { error: `Platform "${platform}" is not supported or not yet available.` },
      { status: 400 },
    );
  }

  // Validate session
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  const payload = verifySignedToken(token);
  if (!payload?.sub) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  // Build the OAuth URL and construct the state cookie value
  let authorizationUrl: string;
  let stateCookieValue: string;

  if (platform === "youtube") {
    authorizationUrl = getGoogleAuthorizationUrl(state);
    stateCookieValue = JSON.stringify({ state, platform });
  } else {
    // TikTok requires PKCE
    const { codeVerifier, codeChallenge } = generatePKCE();
    authorizationUrl = getTikTokAuthorizationUrl(state, codeChallenge);
    stateCookieValue = JSON.stringify({ state, platform, codeVerifier });
  }

  // Store state in a short-lived HttpOnly cookie (10 minutes)
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("oauth_state", stateCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
