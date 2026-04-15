import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";

/**
 * DELETE /api/oauth/tiktok/disconnect
 * Disconnects a user's TikTok account by deactivating the SocialAccount
 * Requirements: 7.1, 8.3, 10.12, 10.13
 */
export async function DELETE(request: NextRequest) {
  // Rate limiting
  // Requirement: 10.13 - Apply rate limiting to OAuth endpoints
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  
  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[DELETE /api/oauth/tiktok/disconnect] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  // Authenticate user
  // Requirement: 8.3 - Return 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/oauth/tiktok/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[DELETE /api/oauth/tiktok/disconnect] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const prisma = getPrisma();

  try {
    // Find the user's TikTok SocialAccount
    // Requirements: 7.2, 10.12 - Query SocialAccount where userId matches and platform="TikTok"
    // Requirement: 10.12 - Validate user owns SocialAccount before disconnection
    console.log("[DELETE /api/oauth/tiktok/disconnect] Finding SocialAccount:", {
      userId: user.id,
      platform: "TikTok",
      timestamp: new Date().toISOString(),
    });

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: user.id,
        platform: "TikTok",
        isActive: true,
      },
    });

    // Requirement: 7.5 - Return 404 if no account found
    if (!socialAccount) {
      console.log("[DELETE /api/oauth/tiktok/disconnect] No active account found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "No connected account found" },
        { status: 404 }
      );
    }

    // Note: Token revocation with TikTok is skipped for performance reasons.
    // Tokens expire naturally, and the account is marked inactive in our database,
    // preventing further use. Users can also revoke access directly in their
    // TikTok account settings if needed.

    // Deactivate the SocialAccount
    // Requirements: 7.3, 7.4 - Set isActive to false, return 200 with success message
    console.log("[DELETE /api/oauth/tiktok/disconnect] Deactivating SocialAccount:", {
      userId: user.id,
      socialAccountId: socialAccount.id,
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

    console.log("[DELETE /api/oauth/tiktok/disconnect] Account disconnected successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    // Requirement: 7.4 - Return 200 with success message
    return NextResponse.json(
      { message: "Account disconnected" },
      { status: 200 }
    );
  } catch (error) {
    // Requirement: 7.6 - Return 500 if database error occurs
    console.error("[DELETE /api/oauth/tiktok/disconnect] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
