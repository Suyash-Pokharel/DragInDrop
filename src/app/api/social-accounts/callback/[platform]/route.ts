import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySignedToken } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/tokenEncryption";
import {
  exchangeGoogleCode,
  getGoogleUserInfo,
} from "@/lib/oauth/google";
import {
  exchangeTikTokCode,
  getTikTokUserInfo,
} from "@/lib/oauth/tiktok";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectWithError(reason: string) {
  return NextResponse.redirect(
    `${APP_URL}/settings/social-accounts?error=${encodeURIComponent(reason)}`,
  );
}

/**
 * GET /api/social-accounts/callback/[platform]
 *
 * Handles the OAuth redirect from the platform. Steps:
 *  1. Read and validate the `oauth_state` cookie (CSRF check).
 *  2. Check `error` query param — abort if the user denied consent.
 *  3. Validate the session cookie (user must still be logged in).
 *  4. Exchange the authorization `code` for access + refresh tokens.
 *  5. Fetch the user's identity on the platform.
 *  6. Encrypt tokens and upsert a `SocialAccount` row in the DB.
 *  7. Clear the `oauth_state` cookie and redirect to the settings page.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // User denied consent on the platform
  if (errorParam) {
    return redirectWithError("access_denied");
  }

  if (!code || !returnedState) {
    return redirectWithError("missing_params");
  }

  // --- CSRF validation ---
  const cookieStore = await cookies();
  const rawStateCookie = cookieStore.get("oauth_state")?.value;
  if (!rawStateCookie) {
    return redirectWithError("missing_state_cookie");
  }

  let stateCookie: { state: string; platform: string; codeVerifier?: string };
  try {
    stateCookie = JSON.parse(rawStateCookie);
  } catch {
    return redirectWithError("invalid_state_cookie");
  }

  if (
    stateCookie.state !== returnedState ||
    stateCookie.platform !== platform
  ) {
    return redirectWithError("state_mismatch");
  }

  // --- Session validation ---
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) {
    return redirectWithError("not_authenticated");
  }
  const payload = verifySignedToken(sessionToken);
  if (!payload?.sub) {
    return redirectWithError("invalid_session");
  }
  const userId = payload.sub;

  try {
    const prisma = getPrisma();

    if (platform === "youtube") {
      // Exchange code for Google tokens
      const tokens = await exchangeGoogleCode(code);
      const userInfo = await getGoogleUserInfo(tokens.accessToken);

      await prisma.socialAccount.upsert({
        where: { userId_platform: { userId, platform: "youtube" } },
        create: {
          userId,
          platform: "youtube",
          platformUserId: userInfo.platformUserId,
          platformUsername: userInfo.platformUsername,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
        update: {
          platformUserId: userInfo.platformUserId,
          platformUsername: userInfo.platformUsername,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
      });
    } else if (platform === "tiktok") {
      const codeVerifier = stateCookie.codeVerifier;
      if (!codeVerifier) {
        return redirectWithError("missing_pkce_verifier");
      }

      const tokens = await exchangeTikTokCode(code, codeVerifier);
      const userInfo = await getTikTokUserInfo(tokens.accessToken, tokens.openId);

      await prisma.socialAccount.upsert({
        where: { userId_platform: { userId, platform: "tiktok" } },
        create: {
          userId,
          platform: "tiktok",
          platformUserId: userInfo.platformUserId,
          platformUsername: userInfo.platformUsername,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
        update: {
          platformUserId: userInfo.platformUserId,
          platformUsername: userInfo.platformUsername,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
      });
    } else {
      return redirectWithError("unsupported_platform");
    }

    // Success — clear the state cookie and redirect
    const successResponse = NextResponse.redirect(
      `${APP_URL}/settings/social-accounts?connected=${encodeURIComponent(platform)}`,
    );
    successResponse.cookies.set("oauth_state", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    return successResponse;
  } catch (err) {
    console.error(`[oauth-callback/${platform}] Error:`, err);
    return redirectWithError("server_error");
  }
}
