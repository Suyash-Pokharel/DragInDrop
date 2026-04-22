import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await ensureAuth();
    if (user instanceof NextResponse) {
      return user;
    }

    const prisma = getPrisma();
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        platform: true,
      },
    });

    const connectedPlatforms = socialAccounts.map((account) => account.platform);

    return NextResponse.json({ connectedPlatforms });
  } catch (error) {
    console.error("[GET /api/user/connected-platforms] Error fetching connected platforms:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to fetch connected platforms" },
      { status: 500 }
    );
  }
}
