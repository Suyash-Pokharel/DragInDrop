import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";
import { cookies } from "next/headers";

/**
 * GET /api/social-accounts
 * Fetch all connected social accounts for the current user
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const prisma = getPrisma();
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId: user.id },
      select: {
        platform: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      platforms: socialAccounts.map((account) => ({
        platform: account.platform,
        connectedAt: account.createdAt,
        expiresAt: account.expiresAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching connected platforms:", error);
    return NextResponse.json(
      { error: "Failed to fetch connected platforms" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social-accounts
 * Disconnect a social account for the current user
 * Expects JSON body: { platform: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { platform } = body;

    if (!platform || typeof platform !== "string") {
      return NextResponse.json(
        { error: "Platform parameter is required" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    await prisma.socialAccount.delete({
      where: {
        userId_platform: {
          userId: user.id,
          platform,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting platform:", error);
    return NextResponse.json(
      { error: "Failed to disconnect platform" },
      { status: 500 }
    );
  }
}
