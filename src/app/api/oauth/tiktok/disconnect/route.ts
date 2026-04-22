import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";
import { perIpOAuthLimiter, perUserOAuthLimiter } from "@/lib/limiter";

export async function DELETE(request: NextRequest) {
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

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/oauth/tiktok/disconnect] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

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

    return NextResponse.json(
      { message: "Account disconnected" },
      { status: 200 }
    );
  } catch (error) {
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
