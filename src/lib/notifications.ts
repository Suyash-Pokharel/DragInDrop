import { getPrisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

/**
 * Creates a notification for a user with automatic limit enforcement.
 * Ensures users never have more than 10 notifications by deleting the oldest
 * notification when the limit is reached.
 *
 * @param userId - The ID of the user who will receive the notification
 * @param title - Notification title (max 200 characters)
 * @param description - Optional notification description (max 500 characters)
 * @param type - NotificationType enum value
 * @returns The created Notification object
 * @throws Error if database operation fails
 */
export async function createNotification(
  userId: string,
  title: string,
  description: string | null,
  type: NotificationType
) {
  const prisma = getPrisma();

  try {
    // Count existing notifications for user
    const count = await prisma.notification.count({
      where: { userId },
    });

    // If user has 10 or more notifications, delete the oldest
    if (count >= 10) {
      const oldest = await prisma.notification.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      if (oldest) {
        await prisma.notification.delete({
          where: { id: oldest.id },
        });
      }
    }

    // Create new notification with isRead=false
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        description,
        type,
        isRead: false,
      },
    });

    return notification;
  } catch (error) {
    // Structured error logging with timestamp, userId, type, and error message
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        type,
        operation: "createNotification",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    throw new Error("Failed to create notification");
  }
}

/**
 * Formats notification content for social account connected event.
 *
 * @param platform - The social media platform name (e.g., "Instagram", "YouTube")
 * @param username - The platform username that was connected
 * @returns Object with title and description for the notification
 */
export function formatSocialAccountConnected(
  platform: string,
  username: string
): { title: string; description: string } {
  return {
    title: `${platform} account connected`,
    description: `Successfully connected ${username}`,
  };
}

/**
 * Formats notification content for social account disconnected event.
 *
 * @param platform - The social media platform name (e.g., "Instagram", "YouTube")
 * @param username - The platform username that was disconnected
 * @returns Object with title and description for the notification
 */
export function formatSocialAccountDisconnected(
  platform: string,
  username: string
): { title: string; description: string } {
  return {
    title: `${platform} account disconnected`,
    description: `${username} has been removed from your account`,
  };
}

/**
 * Formats notification content for post scheduled event.
 *
 * @param postTitle - The title of the scheduled post
 * @param scheduledFor - The date/time when the post is scheduled to be published
 * @returns Object with title and description for the notification
 */
export function formatPostScheduled(
  postTitle: string,
  scheduledFor: Date
): { title: string; description: string } {
  const formattedDate = scheduledFor.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    title: "Post scheduled",
    description: `'${postTitle}' scheduled for ${formattedDate}`,
  };
}

/**
 * Formats notification content for post draft saved event.
 *
 * @param postTitle - The title of the draft post
 * @returns Object with title and description for the notification
 */
export function formatPostDraftSaved(
  postTitle: string
): { title: string; description: string } {
  return {
    title: "Draft saved",
    description: `'${postTitle}' saved as draft`,
  };
}

/**
 * Formats notification content for upload success event.
 *
 * @param postTitle - The title of the post that was successfully uploaded
 * @param platform - The platform where the post was published
 * @returns Object with title and description for the notification
 */
export function formatUploadSuccess(
  postTitle: string,
  platform: string
): { title: string; description: string } {
  return {
    title: "Upload successful",
    description: `'${postTitle}' published to ${platform}`,
  };
}

/**
 * Formats notification content for upload failed event.
 *
 * @param postTitle - The title of the post that failed to upload
 * @param platform - The platform where the upload failed
 * @param errorMessage - The error message describing why the upload failed
 * @returns Object with title and description for the notification
 */
export function formatUploadFailed(
  postTitle: string,
  platform: string,
  errorMessage: string
): { title: string; description: string } {
  return {
    title: "Upload failed",
    description: `'${postTitle}' failed to publish to ${platform}: ${errorMessage}`,
  };
}
