import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";

/**
 * PUT /api/notifications/read
 * Marks all notifications as read for the authenticated user
 */
export async function PUT() {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    console.log("[Notifications API PUT /read] User:", user ? `${user.id} (${user.email})` : "null");

    if (!user) {
      console.log("[Notifications API PUT /read] Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();

    // Update all notifications for the authenticated user to set isRead=true
    const result = await prisma.notification.updateMany({
      where: { 
        userId: user.id,
        isRead: false // Only update unread notifications for efficiency
      },
      data: { isRead: true },
    });

    console.log("[Notifications API PUT /read] Notifications marked as read:", {
      userId: user.id,
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("[Notifications API PUT /read] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
