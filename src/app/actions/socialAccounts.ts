"use server";

import { getPrisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";

type Result = { success: true } | { success: false; error: string };

export interface ConnectedPlatform {
  platform: string;
  connectedAt: Date;
  expiresAt: Date | null;
}

/**
 * Get all connected social accounts for the current user
 */
export async function getConnectedPlatforms(): Promise<{
  success: boolean;
  platforms?: ConnectedPlatform[];
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return { success: false, error: "Not authenticated" };
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

    const platforms: ConnectedPlatform[] = socialAccounts.map((account) => ({
      platform: account.platform,
      connectedAt: account.createdAt,
      expiresAt: account.expiresAt,
    }));

    return { success: true, platforms };
  } catch (error) {
    console.error("Error fetching connected platforms:", error);
    return { success: false, error: "Failed to fetch connected platforms" };
  }
}

/**
 * Disconnect a social account for the current user
 */
export async function disconnectPlatform(platform: string): Promise<Result> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return { success: false, error: "Not authenticated" };
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

    return { success: true };
  } catch (error) {
    console.error("Error disconnecting platform:", error);
    return { success: false, error: "Failed to disconnect platform" };
  }
}
