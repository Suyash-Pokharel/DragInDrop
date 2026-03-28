/**
 * Google OAuth 2.0 helpers for YouTube integration.
 *
 * Scopes requested:
 *   - openid, email, profile       → identify the Google account
 *   - youtube.upload               → upload videos
 *   - youtube.readonly             → fetch channel info
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL            → used to build the redirect URI
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/social-accounts/callback/youtube`;
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

/** Builds the Google consent page URL. */
export function getGoogleAuthorizationUrl(state: string): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "offline",   // requests a refresh token
    prompt: "consent",         // always show consent so refresh token is issued
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
}

/** Exchanges an authorization code for access + refresh tokens. */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientCredentials();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope ?? "",
  };
}

export interface GoogleUserInfo {
  platformUserId: string;
  platformUsername: string;
}

/**
 * Fetches the connected user's YouTube channel name and Google account ID.
 * Falls back to the Google profile name if no YouTube channel exists.
 */
export async function getGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  // Try YouTube channel first (preferred display name)
  const ytRes = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (ytRes.ok) {
    const ytData = await ytRes.json();
    const channel = ytData.items?.[0];
    if (channel) {
      return {
        platformUserId: channel.id,
        platformUsername: channel.snippet?.title ?? "YouTube Channel",
      };
    }
  }

  // Fallback: Google profile info
  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google user info.");
  }
  const profile = await profileRes.json();
  return {
    platformUserId: profile.sub,
    platformUsername: profile.name ?? profile.email ?? "Google Account",
  };
}

/** Uses the refresh token to obtain a new access token. */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientId, clientSecret } = getClientCredentials();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
