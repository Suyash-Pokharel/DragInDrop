import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";
import { createNotification, formatSocialAccountDisconnected } from "@/lib/notifications";

/**
 * DELETE /api/oauth/youtube/disconnect
 * Disconnects a user's YouTube account by deactivating the SocialAccount
 */
export async function DELETE(request: NextRequest) {
  // Rate limiting
  //  Apply rate limiting to OAuth endpoints
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (ip !== "unknown") {
      await perIpOAuthLimiter.consume(ip);
    }
  } catch {
    console.error("[DELETE /api/oauth/youtube/disconnect] Rate limit exceeded:", {
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
    console.error("[DELETE /api/oauth/youtube/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  // Per-user rate limiting
  try {
    await perUserOAuthLimiter.consume(user.id);
  } catch {
    console.error("[DELETE /api/oauth/youtube/disconnect] User rate limit exceeded:", {
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
    // Find the user's YouTube SocialAccount
    //  Query SocialAccount where userId matches and platform="YouTube"
    //  Validate user owns SocialAccount before disconnection
    console.log("[DELETE /api/oauth/youtube/disconnect] Finding SocialAccount:", {
      userId: user.id,
      platform: "YouTube",
      timestamp: new Date().toISOString(),
    });

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: user.id,
        platform: "YouTube",
        isActive: true,
      },
    });

    //  Return 404 if no account found
    if (!socialAccount) {
      console.log("[DELETE /api/oauth/youtube/disconnect] No active account found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "No connected account found" }, { status: 404 });
    }

    // Note: Token revocation with Google is skipped for performance reasons.
    // Tokens expire naturally (typically within 1 hour), and the account is marked
    // inactive in our database, preventing further use. Users can also revoke access
    // directly in their Google Account settings if needed.

    // Retrieve platform and username before deactivation for notification
    const platform = socialAccount.platform;
    const username = socialAccount.platformUsername;

    // Deactivate the SocialAccount
    //  Set isActive to false, return 200 with success message
    console.log("[DELETE /api/oauth/youtube/disconnect] Deactivating SocialAccount:", {
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

    console.log("[DELETE /api/oauth/youtube/disconnect] Account disconnected successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    // Create notification for social account disconnection
    try {
      const { title, description } = formatSocialAccountDisconnected(platform, username || "Unknown");
      await createNotification(user.id, title, description, "SOCIAL_ACCOUNT_DISCONNECTED");
      console.log("[DELETE /api/oauth/youtube/disconnect] Notification created successfully:", {
        userId: user.id,
        platform,
        timestamp: new Date().toISOString(),
      });
    } catch (notificationError) {
      // Log error but don't fail the disconnection flow
      console.error("[DELETE /api/oauth/youtube/disconnect] Failed to create notification:", {
        userId: user.id,
        platform,
        timestamp: new Date().toISOString(),
        error: notificationError instanceof Error ? notificationError.message : "Unknown error",
      });
    }

    //  Return 200 with success message
    return NextResponse.json({ message: "Account disconnected" }, { status: 200 });
  } catch (error) {
    //  Return 500 if database error occurs
    console.error("[DELETE /api/oauth/youtube/disconnect] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }
}
