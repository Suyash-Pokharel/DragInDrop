import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

function convertToUTC(dateTimeStr: string, timezone: string): Date {
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error('Invalid datetime format');
  }
  
  const [, year, month, day, hour, minute, second = '00'] = match;
  
  const localDateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  const utcDate = new Date(`${localDateStr}Z`);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(utcDate);
  const partsMap: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      partsMap[part.type] = part.value;
    }
  });
  
  const tzYear = parseInt(partsMap.year);
  const tzMonth = parseInt(partsMap.month);
  const tzDay = parseInt(partsMap.day);
  const tzHour = parseInt(partsMap.hour);
  const tzMinute = parseInt(partsMap.minute);
  const tzSecond = parseInt(partsMap.second);
  
  const utcMs = utcDate.getTime();
  const tzDateMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
  const offset = utcMs - tzDateMs;
  
  const targetLocalMs = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  const targetUtcMs = targetLocalMs + offset;
  
  return new Date(targetUtcMs);
}

const createPostSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .max(250, "Description must not exceed 250 characters")
    .optional(),
  scheduledFor: z
    .string({ message: "Scheduled time is required" })
    .refine(
      (dateStr) => {
        const scheduledDate = new Date(dateStr);
        return scheduledDate > new Date();
      },
      { message: "Scheduled time must be in the future" }
    ),
  videoFileKey: z
    .string({ message: "Video file key is required" })
    .min(1, "Video file key is required"),
  videoFileName: z
    .string({ message: "Video file name is required" })
    .min(1, "Video file name is required"),
  videoFileSize: z
    .number({ message: "Video file size is required" })
    .positive("Video file size must be positive"),
  selectedPlatforms: z
    .array(z.string(), { message: "At least one platform must be selected" })
    .min(1, "At least one platform must be selected"),
});

export async function POST(request: NextRequest) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[POST /api/posts] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const body = await request.json();

    const validationResult = createPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      console.error("[POST /api/posts] Validation error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: firstError.message,
        field: firstError.path.join("."),
        receivedValue: firstError.path.length > 0 ? body[firstError.path[0]] : undefined,
      });
      
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      scheduledFor,
      videoFileKey,
      videoFileName,
      videoFileSize,
      selectedPlatforms,
    } = validationResult.data;

    const prisma = getPrisma();

    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
      select: { timezone: true },
    });

    const userTimezone = userPreferences?.timezone || 'UTC';
    const scheduledForUTC = convertToUTC(scheduledFor, userTimezone);

    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        platform: { in: selectedPlatforms },
        isActive: true,
      },
    });

    const foundPlatforms = socialAccounts.map((sa) => sa.platform);
    const missingPlatforms = selectedPlatforms.filter(
      (platform) => !foundPlatforms.includes(platform)
    );

    if (missingPlatforms.length > 0) {
      console.error("[POST /api/posts] Missing SocialAccount error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Invalid platform selection",
        missingPlatforms,
        selectedPlatforms,
        foundPlatforms,
      });
      
      const errorMessage = missingPlatforms.length === 1
        ? `${missingPlatforms[0]} account not connected`
        : `Invalid platform selection: ${missingPlatforms.join(", ")}`;
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const platformToAccountMap = new Map(
      socialAccounts.map((sa) => [sa.platform, sa.id])
    );

    const result = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          title,
          description: description || null,
          videoFileKey,
          videoFileName,
          videoFileSize,
          scheduledFor: scheduledForUTC,
          status: "SCHEDULED",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const platformPosts = await Promise.all(
        selectedPlatforms.map((platform) =>
          tx.platformPost.create({
            data: {
              id: crypto.randomUUID(),
              postId: post.id,
              socialAccountId: platformToAccountMap.get(platform)!,
              status: "PENDING",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        )
      );

      return { post, platformPosts };
    });

    console.log("[POST /api/posts] Post created successfully:", {
      userId: user.id,
      postId: result.post.id,
      timestamp: new Date().toISOString(),
      platformCount: result.platformPosts.length,
      platforms: selectedPlatforms,
      userTimezone,
      scheduledForUTC: scheduledForUTC.toISOString(),
    });

    return NextResponse.json(
      { success: true, postId: result.post.id, message: "Post created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/posts] Database error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
