import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { createNotification, formatSocialAccountDisconnected } from "@/lib/notifications";

/**
 * DELETE /api/oauth/threads/disconnect
 * Disconnects a user's Threads account by deactivating the SocialAccount
 */
export async function DELETE(request: NextRequest) {
  // Rate limiting
  //  Apply per-IP rate limiting (10 requests per 15 minutes)
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[DELETE /api/oauth/threads/disconnect] Rate limit exceeded:", {
      ip,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  // Authenticate user
  //  Return 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/oauth/threads/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  //  Apply per-user rate limiting (5 requests per 15 minutes)
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[DELETE /api/oauth/threads/disconnect] User rate limit exceeded:", {
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
    // Find the user's Threads SocialAccount
    //  Mark SocialAccount as inactive (isActive=false)
    //  Do not delete the SocialAccount record to preserve historical data
    console.log("[DELETE /api/oauth/threads/disconnect] Finding SocialAccount:", {
      userId: user.id,
      platform: "Threads",
      timestamp: new Date().toISOString(),
    });

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: user.id,
        platform: "Threads",
        isActive: true,
      },
    });

    //  Return 404 if no active account found
    if (!socialAccount) {
      console.log("[DELETE /api/oauth/threads/disconnect] No active account found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "No connected account found" }, { status: 404 });
    }

    // Note: Token revocation with Threads is skipped for performance reasons.
    // Tokens expire naturally (long-lived tokens expire in 60 days), and the account
    // is marked inactive in our database, preventing further use. Users can also
    // revoke access directly in their Threads account settings if needed.

    // Retrieve platform and username before deactivation for notification
    const platform = socialAccount.platform;
    const username = socialAccount.platformUsername;

    // Deactivate the SocialAccount
    //  Mark SocialAccount as inactive (isActive=false)
    //  Do not delete the SocialAccount record to preserve historical data
    console.log("[DELETE /api/oauth/threads/disconnect] Deactivating SocialAccount:", {
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

    //  Log disconnection with userId, platform, and timestamp
    console.log("[DELETE /api/oauth/threads/disconnect] Account disconnected successfully:", {
      userId: user.id,
      platform: "Threads",
      timestamp: new Date().toISOString(),
    });

    // Create notification for social account disconnection
    try {
      const { title, description } = formatSocialAccountDisconnected(platform, username || "Unknown");
      await createNotification(user.id, title, description, "SOCIAL_ACCOUNT_DISCONNECTED");
      console.log("[DELETE /api/oauth/threads/disconnect] Notification created successfully:", {
        userId: user.id,
        platform,
        timestamp: new Date().toISOString(),
      });
    } catch (notificationError) {
      // Log error but don't fail the disconnection flow
      console.error("[DELETE /api/oauth/threads/disconnect] Failed to create notification:", {
        userId: user.id,
        platform,
        timestamp: new Date().toISOString(),
        error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      });
    }

    //  Return 200 with success message
    return NextResponse.json(
      { success: true, message: "Threads account disconnected" },
      { status: 200 },
    );
  } catch (error) {
    //  Return 500 if database error occurs
    console.error("[DELETE /api/oauth/threads/disconnect] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }
}

/**
 * POST /api/oauth/threads/disconnect
 * Disconnects a user's Threads account by deactivating the SocialAccount
 *
 * Note: This is kept for backward compatibility. Use DELETE method instead.
 */
export async function POST(request: NextRequest) {
  return DELETE(request);
}
