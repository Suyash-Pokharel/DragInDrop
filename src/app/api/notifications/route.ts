import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import { NotificationType } from "@prisma/client";

// Zod schema for POST request validation
const createNotificationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  type: z.nativeEnum(NotificationType, {
    message: "Invalid notification type",
  }),
});

export async function GET() {
  try {
    const user = await getCurrentUser();

    console.log("[Notifications API] User:", user ? `${user.id} (${user.email})` : "null");

    if (!user) {
      console.log("[Notifications API] Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();

    // Query notifications for the authenticated user, sorted by createdAt DESC (newest first)
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    });

    console.log("[Notifications API] Found notifications:", {
      userId: user.id,
      count: notifications.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("[Notifications API] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    console.log("[Notifications API POST] User:", user ? `${user.id} (${user.email})` : "null");

    if (!user) {
      console.log("[Notifications API POST] Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createNotificationSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      
      console.log("[Notifications API POST] Validation failed:", {
        userId: user.id,
        errors: validationResult.error.issues,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { title, description, type } = validationResult.data;

    // Call createNotification helper function (enforces 10-notification limit)
    const notification = await createNotification(
      user.id,
      title,
      description ?? null,
      type
    );

    console.log("[Notifications API POST] Notification created:", {
      userId: user.id,
      notificationId: notification.id,
      type: notification.type,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { notification },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Notifications API POST] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
