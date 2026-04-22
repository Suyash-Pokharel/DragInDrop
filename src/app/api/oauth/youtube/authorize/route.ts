import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  
  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[GET /api/oauth/youtube/authorize] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/youtube/authorize] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[GET /api/oauth/youtube/authorize] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret) {
      console.error("[GET /api/oauth/youtube/authorize] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    const csrfToken = randomBytes(32).toString("hex");
    const csrfTimestamp = Date.now().toString();

    const redirectUri = `${appUrl}/api/oauth/youtube/callback`;
    
    const isProduction = process.env.NODE_ENV === "production";
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/youtube/authorize] Invalid redirect URI protocol:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        redirectUri,
        isProduction,
      });
      return NextResponse.json(
        { error: "OAuth configuration error: HTTPS required in production" },
        { status: 500 }
      );
    }
    
    const scope = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
    const responseType = "code";
    const accessType = "offline";
    const prompt = "consent";

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", responseType);
    authUrl.searchParams.set("state", csrfToken);
    authUrl.searchParams.set("access_type", accessType);
    authUrl.searchParams.set("prompt", prompt);

    console.log("[GET /api/oauth/youtube/authorize] Authorization initiated:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientId,
    });

    const response = NextResponse.redirect(authUrl.toString());

    const maxAge = 10 * 60;
    response.cookies.set("youtube_oauth_state", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    response.cookies.set("youtube_oauth_state_timestamp", csrfTimestamp, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[GET /api/oauth/youtube/authorize] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to initiate authorization" },
      { status: 500 }
    );
  }
}
