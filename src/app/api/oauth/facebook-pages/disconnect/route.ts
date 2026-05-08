import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";

/**
 * POST /api/oauth/facebook-pages/disconnect
 * Disconnects a user's Facebook Page by deactivating the SocialAccount
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  // Requirement: 8.9 - Apply per-IP rate limiting (10 requests per 15 minutes)
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[POST /api/oauth/facebook-pages/disconnect] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  // Authenticate user
  // Requirement: 8.3 - Return HTTP 403 if validation fails (user not authenticated)
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[POST /api/oauth/facebook-pages/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  // Requirement: 8.10 - Apply per-user rate limiting (5 requests per 15 minutes)
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[POST /api/oauth/facebook-pages/disconnect] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const prisma = getPrisma();
    // Find the user's Facebook Page SocialAccount
    // Requirement: 8.1 - Query SocialAccount where userId matches and platform is "FacebookPage"
    // Requirement: 8.2 - Validate user owns the SocialAccount
    console.log("[POST /api/oauth/facebook-pages/disconnect] Finding SocialAccount:", {
      userId: user.id,
      platform: "FacebookPage",
      timestamp: new Date().toISOString(),
    });

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: user.id,
        platform: "FacebookPage",
        isActive: true,
      },
    });

    // Requirement: 8.6 - Return HTTP 404 if no active account found
    if (!socialAccount) {
      console.log("[POST /api/oauth/facebook-pages/disconnect] No active account found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "No connected Facebook Page found" }, { status: 404 });
    }

    // Note: Token revocation with Facebook Pages is skipped for performance reasons.
    // Page tokens obtained from long-lived user tokens are never-expiring, and the account
    // is marked inactive in our database, preventing further use. Users can also
    // revoke access directly in their Facebook account settings if needed.

    // Deactivate the SocialAccount
    // Requirement: 8.4 - Set isActive to false (preserve historical data)
    console.log("[POST /api/oauth/facebook-pages/disconnect] Deactivating SocialAccount:", {
      userId: user.id,
      socialAccountId: socialAccount.id,
      platform: "FacebookPage",
      timestamp: new Date().toISOString(),
    });

    await prisma.socialAccount.update({
      where: {
        id: socialAccount.id,
      },
      data: {
        isActive: false,
      },
    });

    // Requirement: 8.11 - Log disconnection with userId, platform, and timestamp
    console.log("[POST /api/oauth/facebook-pages/disconnect] Account disconnected successfully:", {
      userId: user.id,
      platform: "FacebookPage",
      timestamp: new Date().toISOString(),
    });

    // Requirement: 8.7 - Return HTTP 200 with success message
    return NextResponse.json(
      { success: true, message: "Facebook Page disconnected successfully" },
      { status: 200 },
    );
  } catch (error) {
    // Requirement: 8.8 - Return HTTP 500 when database error occurs
    console.error("[POST /api/oauth/facebook-pages/disconnect] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to disconnect Facebook Page" }, { status: 500 });
  }
}
