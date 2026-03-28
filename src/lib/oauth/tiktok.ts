/**
 * TikTok OAuth 2.0 helpers with PKCE (required by TikTok's API v2).
 *
 * Scopes requested:
 *   - user.info.basic   → fetch user's display name and open_id
 *   - video.upload      → upload videos
 *   - video.publish     → publish uploaded videos
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL   → used to build the redirect URI
 *
 * TikTok Developer Portal setup:
 *   Redirect URI: https://your-domain.vercel.app/api/social-accounts/callback/tiktok
 *   (also add http://localhost:3000/api/social-accounts/callback/tiktok for dev)
 */

import crypto from "crypto";

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USERINFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";

const SCOPES = "user.info.basic,video.upload,video.publish";

function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/social-accounts/callback/tiktok`;
}

function getClientCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET");
  }
  return { clientKey, clientSecret };
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generates a PKCE code_verifier and SHA-256 code_challenge.
 * Store the verifier server-side (in a cookie) and send the challenge to TikTok.
 */
export function generatePKCE(): PKCEPair {
  // code_verifier: 43-128 char URL-safe random string
  const codeVerifier = crypto
    .randomBytes(64)
    .toString("base64url")
    .substring(0, 128);

  // code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/** Builds the TikTok consent page URL. */
export function getTikTokAuthorizationUrl(
  state: string,
  codeChallenge: string,
): string {
  const { clientKey } = getClientCredentials();
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
  openId: string; // TikTok's unique user identifier
}

/** Exchanges an authorization code (+ PKCE verifier) for tokens. */
export async function exchangeTikTokCode(
  code: string,
  codeVerifier: string,
): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getClientCredentials();

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok token exchange failed: ${text}`);
  }

  const json = await res.json();
  const data = json.data ?? json; // TikTok API v2 wraps data in a `data` key

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 86400) * 1000),
    scope: data.scope ?? SCOPES,
    openId: data.open_id,
  };
}

export interface TikTokUserInfo {
  platformUserId: string;
  platformUsername: string;
}

/** Fetches the authenticated TikTok user's display name and open_id. */
export async function getTikTokUserInfo(
  accessToken: string,
  openId: string,
): Promise<TikTokUserInfo> {
  const res = await fetch(TIKTOK_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // Fallback to open_id if user info fetch fails
    return { platformUserId: openId, platformUsername: `TikTok user` };
  }

  const json = await res.json();
  const user = json.data?.user ?? {};
  return {
    platformUserId: user.open_id ?? openId,
    platformUsername: user.display_name ?? "TikTok User",
  };
}

/** Refreshes an expired TikTok access token using the refresh token. */
export async function refreshTikTokAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientKey, clientSecret } = getClientCredentials();

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok token refresh failed: ${text}`);
  }

  const json = await res.json();
  const data = json.data ?? json;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 86400) * 1000),
  };
}
