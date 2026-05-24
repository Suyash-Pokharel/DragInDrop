import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";

/**
 * PUT /api/notifications/[id]
 * Marks a single notification as read
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    console.log("[Notifications API PUT] User:", user ? `${user.id} (${user.email})` : "null");

    if (!user) {
      console.log("[Notifications API PUT] Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract notification ID from URL parameter
    const { id } = await params;

    if (!id) {
      console.log("[Notifications API PUT] Bad request - no ID provided");
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const prisma = getPrisma();

    // Query notification by ID
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    });

    // Return 404 if notification not found
    if (!notification) {
      console.log("[Notifications API PUT] Notification not found:", {
        notificationId: id,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Verify notification belongs to authenticated user
    if (notification.userId !== user.id) {
      console.log("[Notifications API PUT] Unauthorized - notification belongs to different user:", {
        notificationId: id,
        notificationUserId: notification.userId,
        requestUserId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update isRead to true
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    });

    console.log("[Notifications API PUT] Notification marked as read:", {
      notificationId: id,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ notification: updatedNotification });
  } catch (error) {
    console.error("[Notifications API PUT] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
