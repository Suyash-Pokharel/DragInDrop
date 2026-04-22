import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { encryptToken } from "@/lib/encryption";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { validateHttps } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  
  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[GET /api/oauth/tiktok/callback] Rate limit exceeded:", {
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
    console.error("[GET /api/oauth/tiktok/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[GET /api/oauth/tiktok/callback] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const prisma = getPrisma();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.log("[GET /api/oauth/tiktok/callback] Authorization denied:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error,
      });
      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Authorization denied")}`
      );
    }

    if (!code) {
      console.error("[GET /api/oauth/tiktok/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    const storedState = request.cookies.get("tiktok_oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid state parameter:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        stateProvided: !!state,
        stateStored: !!storedState,
        stateMatch: state === storedState,
      });
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    const codeVerifier = request.cookies.get("tiktok_code_verifier")?.value;
    if (!codeVerifier) {
      console.error("[GET /api/oauth/tiktok/callback] Missing code_verifier:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Invalid OAuth session" },
        { status: 400 }
      );
    }

    const redirectUri = `${appUrl}/api/oauth/tiktok/callback`;
    const isProduction = process.env.NODE_ENV === "production";
    
    if (!validateHttps(redirectUri, isProduction)) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid redirect URI protocol:", {
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

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      console.error("[GET /api/oauth/tiktok/callback] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET",
      });
      return NextResponse.json(
        { error: "OAuth configuration error" },
        { status: 500 }
      );
    }

    const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";

    const tokenParams = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    console.log("[GET /api/oauth/tiktok/callback] Exchanging authorization code:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      redirectUri,
      appUrl,
      clientKey,
      codeLength: code.length,
      tokenParamsString: tokenParams.toString(),
    });

    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000);

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
        signal: tokenController.signal,
      });
    } catch (fetchError) {
      clearTimeout(tokenTimeout);
      
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/tiktok/callback] Token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    } finally {
      clearTimeout(tokenTimeout);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/tiktok/callback] Token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        error: errorData,
      });
      
      if (tokenResponse.status === 429) {
        const retryAfter = tokenResponse.headers.get("retry-after") || "60";
        return NextResponse.json(
          { error: `Rate limit exceeded. Please try again after ${retryAfter} seconds.` },
          { 
            status: 429,
            headers: {
              "Retry-After": retryAfter,
            },
          }
        );
      }
      
      const errorCode = errorData.error || errorData.error_code;
      const errorDescription = errorData.error_description || errorData.message;
      
      if (errorCode === "redirect_uri_mismatch" || 
          (errorDescription && errorDescription.toLowerCase().includes("redirect"))) {
        return NextResponse.redirect(
          `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Redirect URI mismatch")}`
        );
      }
      
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      open_id,
    } = tokenData;

    if (!access_token || !refresh_token || !open_id) {
      console.error("[GET /api/oauth/tiktok/callback] Invalid token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        hasOpenId: !!open_id,
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 }
      );
    }

    const profileUrl = "https://open.tiktokapis.com/v2/user/info/";
    const profileParams = new URLSearchParams({
      fields: "open_id,union_id,avatar_url,display_name",
    });

    const profileController = new AbortController();
    const profileTimeout = setTimeout(() => profileController.abort(), 10000);

    let profileResponse: Response;
    try {
      profileResponse = await fetch(`${profileUrl}?${profileParams.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        signal: profileController.signal,
      });
    } catch (fetchError) {
      clearTimeout(profileTimeout);
      
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/tiktok/callback] Profile fetch timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json(
          { error: "Request timeout. Please try again." },
          { status: 504 }
        );
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    } finally {
      clearTimeout(profileTimeout);
    }

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/tiktok/callback] Profile fetch failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: profileResponse.status,
        error: errorData,
        responseHeaders: Object.fromEntries(profileResponse.headers.entries()),
      });
      
      if (profileResponse.status === 429) {
        const retryAfter = profileResponse.headers.get("retry-after") || "60";
        return NextResponse.json(
          { error: `Rate limit exceeded. Please try again after ${retryAfter} seconds.` },
          { 
            status: 429,
            headers: {
              "Retry-After": retryAfter,
            },
          }
        );
      }
      
      console.warn("[GET /api/oauth/tiktok/callback] Profile fetch failed, using open_id as fallback:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        openId: open_id,
      });
      
      const platformUsername = open_id;
      
      const expiresAt = new Date(Date.now() + expires_in * 1000);
      
      let encryptedAccessToken: string;
      let encryptedRefreshToken: string;

      try {
        encryptedAccessToken = encryptToken(access_token);
        encryptedRefreshToken = encryptToken(refresh_token);
      } catch (encryptionError) {
        console.error("[GET /api/oauth/tiktok/callback] Token encryption failed:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: encryptionError instanceof Error ? encryptionError.message : "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to save account connection" },
          { status: 500 }
        );
      }

      try {
        await prisma.socialAccount.upsert({
          where: {
            userId_platform_platformAccountId: {
              userId: user.id,
              platform: "TikTok",
              platformAccountId: open_id,
            },
          },
          update: {
            platformUsername,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            isActive: true,
          },
          create: {
            id: crypto.randomUUID(),
            userId: user.id,
            platform: "TikTok",
            platformAccountId: open_id,
            platformUsername,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log("[GET /api/oauth/tiktok/callback] SocialAccount saved successfully (without profile):", {
          userId: user.id,
          platform: "TikTok",
          timestamp: new Date().toISOString(),
        });
        
        const response = NextResponse.redirect(
          `${appUrl}/settings/social-accounts?success=${encodeURIComponent("TikTok account connected successfully")}`
        );
        response.cookies.delete("tiktok_oauth_state");
        response.cookies.delete("tiktok_code_verifier");
        return response;
      } catch (dbError) {
        console.error("[GET /api/oauth/tiktok/callback] Database error:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: dbError instanceof Error ? dbError.message : "Unknown error",
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });
        return NextResponse.json(
          { error: "Failed to save account connection" },
          { status: 500 }
        );
      }
    }

    const profileData = await profileResponse.json();
    const tiktokUser = profileData.data?.user;

    console.log("[GET /api/oauth/tiktok/callback] Profile data received:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      hasUser: !!tiktokUser,
      profileData: profileData,
    });

    const platformUsername = tiktokUser?.display_name || open_id;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    console.log("[GET /api/oauth/tiktok/callback] Encrypting tokens:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;

    try {
      encryptedAccessToken = encryptToken(access_token);
      encryptedRefreshToken = encryptToken(refresh_token);
    } catch (encryptionError) {
      console.error("[GET /api/oauth/tiktok/callback] Token encryption failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: encryptionError instanceof Error ? encryptionError.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "Failed to save account connection" },
        { status: 500 }
      );
    }

    console.log("[GET /api/oauth/tiktok/callback] Saving SocialAccount:", {
      userId: user.id,
      platform: "TikTok",
      platformAccountId: open_id,
      timestamp: new Date().toISOString(),
    });

    try {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_platformAccountId: {
            userId: user.id,
            platform: "TikTok",
            platformAccountId: open_id,
          },
        },
        update: {
          platformUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
        },
        create: {
          id: crypto.randomUUID(),
          userId: user.id,
          platform: "TikTok",
          platformAccountId: open_id,
          platformUsername,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("[GET /api/oauth/tiktok/callback] SocialAccount saved successfully:", {
        userId: user.id,
        platform: "TikTok",
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error("[GET /api/oauth/tiktok/callback] Database error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: dbError instanceof Error ? dbError.message : "Unknown error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      return NextResponse.json(
        { error: "Failed to save account connection" },
        { status: 500 }
      );
    }

    const response = NextResponse.redirect(
      `${appUrl}/settings/social-accounts?success=${encodeURIComponent("TikTok account connected successfully")}`
    );
    response.cookies.delete("tiktok_oauth_state");
    response.cookies.delete("tiktok_code_verifier");

    return response;
  } catch (error) {
    console.error("[GET /api/oauth/tiktok/callback] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to complete OAuth callback" },
      { status: 500 }
    );
  }
}
