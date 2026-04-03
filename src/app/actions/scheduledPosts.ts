"use server";

import { getPrisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";

export interface ScheduledPostData {
  id: string;
  platform: string;
  scheduledDate: Date;
  title: string | null;
  description: string | null;
  status: string;
}

/**
 * Get all scheduled posts for the current user
 * Optimized for calendar view - only returns necessary fields
 */
export async function getScheduledPosts(): Promise<{
  success: boolean;
  posts?: ScheduledPostData[];
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
    const posts = await prisma.scheduledPost.findMany({
      where: { 
        userId: user.id,
        // Only get pending and published posts (not failed)
        status: {
          in: ["pending", "published"]
        }
      },
      select: {
        id: true,
        platform: true,
        scheduledDate: true,
        title: true,
        description: true,
        status: true,
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    });

    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching scheduled posts:", error);
    return { success: false, error: "Failed to fetch scheduled posts" };
  }
}

/**
 * Get scheduled posts for a specific month
 * More efficient for calendar pagination
 */
export async function getScheduledPostsForMonth(
  year: number,
  month: number
): Promise<{
  success: boolean;
  posts?: ScheduledPostData[];
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const user = await getCurrentUserFromToken(sessionToken);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Calculate start and end dates for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const prisma = getPrisma();
    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId: user.id,
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ["pending", "published"]
        }
      },
      select: {
        id: true,
        platform: true,
        scheduledDate: true,
        title: true,
        description: true,
        status: true,
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    });

    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching scheduled posts for month:", error);
    return { success: false, error: "Failed to fetch scheduled posts" };
  }
}

/**
 * Create a new scheduled post
 */
export async function createScheduledPost(data: {
  platform: string;
  videoUploadId: string;
  title: string;
  description?: string;
  tags?: string[];
  scheduledDate: Date;
}): Promise<{
  success: boolean;
  post?: ScheduledPostData;
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
    
    // Create the scheduled post
    const post = await prisma.scheduledPost.create({
      data: {
        userId: user.id,
        platform: data.platform,
        videoUploadId: data.videoUploadId,
        title: data.title,
        description: data.description || null,
        tags: data.tags || [],
        scheduledDate: data.scheduledDate,
        status: "pending",
      },
      select: {
        id: true,
        platform: true,
        scheduledDate: true,
        title: true,
        description: true,
        status: true,
      }
    });

    return { success: true, post };
  } catch (error) {
    console.error("Error creating scheduled post:", error);
    return { success: false, error: "Failed to create scheduled post" };
  }
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(postId: string): Promise<{
  success: boolean;
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
    
    // Verify the post belongs to the user
    const post = await prisma.scheduledPost.findUnique({
      where: { id: postId },
      select: { userId: true }
    });

    if (!post) {
      return { success: false, error: "Post not found" };
    }

    if (post.userId !== user.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Delete the post (will cascade delete associated video upload)
    await prisma.scheduledPost.delete({
      where: { id: postId }
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting scheduled post:", error);
    return { success: false, error: "Failed to delete scheduled post" };
  }
}
