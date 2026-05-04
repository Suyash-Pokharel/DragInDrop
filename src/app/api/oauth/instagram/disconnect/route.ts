import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";

/**
 * DELETE /api/oauth/instagram/disconnect
 * Disconnects a user's Instagram account by deactivating the SocialAccount
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
 */
export async function DELETE(request: NextRequest) {
  // Rate limiting
  // Requirement: 4.8 - Apply per-IP rate limiting (10 requests per 15 minutes)
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[DELETE /api/oauth/instagram/disconnect] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  // Authenticate user
  // Requirement: 4.2 - Return 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/oauth/instagram/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  // Requirement: 4.9 - Apply per-user rate limiting (5 requests per 15 minutes)
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[DELETE /api/oauth/instagram/disconnect] User rate limit exceeded:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  const prisma = getPrisma();

  try {
    // Find the user's Instagram SocialAccount
    // Requirements: 4.3, 4.4 - Query SocialAccount where userId matches and platform="Instagram"
    // Requirement: 4.4 - Validate user owns SocialAccount before disconnection
    console.log("[DELETE /api/oauth/instagram/disconnect] Finding SocialAccount:", {
      userId: user.id,
      platform: "Instagram",
      timestamp: new Date().toISOString(),
    });

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: user.id,
        platform: "Instagram",
        isActive: true,
      },
    });

    // Requirement: 4.6 - Return 404 if no active account found
    if (!socialAccount) {
      console.log("[DELETE /api/oauth/instagram/disconnect] No active account found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "No connected account found" }, { status: 404 });
    }

    // Note: Token revocation with Instagram is skipped for performance reasons.
    // Tokens expire naturally (long-lived tokens expire in 60 days), and the account
    // is marked inactive in our database, preventing further use. Users can also
    // revoke access directly in their Instagram account settings if needed.

    // Deactivate the SocialAccount
    // Requirements: 4.5, 4.7 - Set isActive to false, return 200 with success message
    console.log("[DELETE /api/oauth/instagram/disconnect] Deactivating SocialAccount:", {
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

    // Requirement: 4.9 - Log disconnection with userId, platform, and timestamp
    console.log("[DELETE /api/oauth/instagram/disconnect] Account disconnected successfully:", {
      userId: user.id,
      platform: "Instagram",
      timestamp: new Date().toISOString(),
    });

    // Requirement: 4.7 - Return 200 with success message
    return NextResponse.json(
      { success: true, message: "Instagram account disconnected" },
      { status: 200 },
    );
  } catch (error) {
    // Requirement: 4.8 - Return 500 if database error occurs
    console.error("[DELETE /api/oauth/instagram/disconnect] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }
}
