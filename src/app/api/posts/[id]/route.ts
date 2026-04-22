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

const updatePostSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .max(250, "Description must not exceed 250 characters")
    .optional()
    .nullable(),
  scheduledFor: z
    .string({ message: "Scheduled time is required" })
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid date format"),
  selectedPlatforms: z
    .array(z.string())
    .min(1, "At least one platform must be selected"),
  timezone: z
    .string()
    .optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const prisma = getPrisma();

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        PlatformPost: {
          include: {
            SocialAccount: {
              select: {
                platform: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      console.error("[GET /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });
      
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (post.userId !== user.id) {
      console.error("[GET /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: post.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });
      
      return NextResponse.json(
        { error: "You do not have permission to access this post" },
        { status: 403 }
      );
    }

    const selectedPlatforms = post.PlatformPost.map(
      (platformPost) => platformPost.SocialAccount.platform
    );

    const responseData = {
      id: post.id,
      title: post.title,
      description: post.description,
      scheduledFor: post.scheduledFor.toISOString(),
      status: post.status,
      videoFileKey: post.videoFileKey,
      videoFileName: post.videoFileName,
      videoFileSize: post.videoFileSize,
      selectedPlatforms,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };

    console.log("[GET /api/posts/[id]] Post retrieved successfully:", {
      userId: user.id,
      postId: post.id,
      timestamp: new Date().toISOString(),
      platformCount: selectedPlatforms.length,
      platforms: selectedPlatforms,
      status: post.status,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("[GET /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to retrieve post" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[PUT /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const body = await request.json();
    
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];
      
      console.error("[PUT /api/posts/[id]] Validation failed:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        errors,
      });
      
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { title, description, scheduledFor, selectedPlatforms, timezone } = validationResult.data;

    const prisma = getPrisma();

    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        PlatformPost: {
          include: {
            SocialAccount: {
              select: {
                platform: true,
              },
            },
          },
        },
      },
    });

    if (!existingPost) {
      console.error("[PUT /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });
      
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (existingPost.userId !== user.id) {
      console.error("[PUT /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: existingPost.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });
      
      return NextResponse.json(
        { error: "You do not have permission to edit this post" },
        { status: 403 }
      );
    }

    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
      select: { timezone: true },
    });

    const userTimezone = timezone || userPreferences?.timezone || 'UTC';
    const scheduledForUTC = convertToUTC(scheduledFor, userTimezone);

    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 10 * 60 * 1000);
    
    if (scheduledForUTC <= minScheduleTime) {
      console.error("[PUT /api/posts/[id]] Invalid schedule time:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        scheduledFor: scheduledForUTC.toISOString(),
        minScheduleTime: minScheduleTime.toISOString(),
        error: "Schedule must be at least 10 minutes in the future",
      });
      
      return NextResponse.json(
        { error: "Schedule must be at least 10 minutes in the future" },
        { status: 400 }
      );
    }

    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        platform: { in: selectedPlatforms },
        isActive: true,
      },
    });

    const connectedPlatforms = socialAccounts.map(account => account.platform);
    const missingPlatforms = selectedPlatforms.filter(
      platform => !connectedPlatforms.includes(platform)
    );

    if (missingPlatforms.length > 0) {
      console.error("[PUT /api/posts/[id]] Missing platform connections:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        missingPlatforms,
        error: "User does not have connected accounts for selected platforms",
      });
      
      return NextResponse.json(
        { 
          error: "Missing platform connections", 
          details: missingPlatforms.map(platform => ({
            field: "selectedPlatforms",
            message: `${platform} account not connected`
          }))
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: {
          title,
          description: description || null,
          scheduledFor: scheduledForUTC,
          updatedAt: new Date(),
        },
      });

      const currentPlatformPosts = existingPost.PlatformPost;
      const currentPlatforms = currentPlatformPosts.map((pp) => pp.SocialAccount.platform);

      const platformsToAdd = selectedPlatforms.filter(
        platform => !currentPlatforms.includes(platform)
      );
      const platformsToRemove = currentPlatforms.filter(
        (platform) => !selectedPlatforms.includes(platform)
      );

      if (platformsToRemove.length > 0) {
        const platformPostsToRemove = currentPlatformPosts
          .filter((pp) => platformsToRemove.includes(pp.SocialAccount.platform))
          .map((pp) => pp.id);

        await tx.platformPost.deleteMany({
          where: {
            id: { in: platformPostsToRemove },
          },
        });
      }

      if (platformsToAdd.length > 0) {
        const socialAccountsToAdd = socialAccounts.filter(
          account => platformsToAdd.includes(account.platform)
        );

        const platformPostsToCreate = socialAccountsToAdd.map(account => ({
          id: crypto.randomUUID(),
          postId: id,
          socialAccountId: account.id,
          status: 'PENDING' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await tx.platformPost.createMany({
          data: platformPostsToCreate,
        });
      }

      return updatedPost;
    });

    console.log("[PUT /api/posts/[id]] Post updated successfully:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      title: result.title,
      scheduledFor: result.scheduledFor.toISOString(),
      platformCount: selectedPlatforms.length,
      platforms: selectedPlatforms,
    });

    return NextResponse.json(
      { message: "Post updated successfully" },
      { status: 200 }
    );

  } catch (error) {
    console.error("[PUT /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[DELETE /api/posts/[id]] Authentication failed:", {
      timestamp: new Date().toISOString(),
      postId: id,
      error: "Unauthenticated request",
    });
    return user;
  }

  try {
    const prisma = getPrisma();

    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        videoFileKey: true,
        videoFileName: true,
      },
    });

    if (!existingPost) {
      console.error("[DELETE /api/posts/[id]] Post not found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "Post does not exist",
      });
      
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (existingPost.userId !== user.id) {
      console.error("[DELETE /api/posts/[id]] Authorization failed:", {
        userId: user.id,
        postOwnerId: existingPost.userId,
        timestamp: new Date().toISOString(),
        postId: id,
        error: "User does not own the post",
      });
      
      return NextResponse.json(
        { error: "You do not have permission to delete this post" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformPost.deleteMany({
        where: { postId: id },
      });

      await tx.post.delete({
        where: { id },
      });
    });

    try {
      const authResponse = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.B2_ACCOUNT_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64')}`
        }
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error("[DELETE /api/posts/[id]] B2 authorization failed:", {
          userId: user.id,
          postId: id,
          timestamp: new Date().toISOString(),
          error: errorText,
          videoFileKey: existingPost.videoFileKey,
        });
      } else {
        const authData = await authResponse.json();
        const { authorizationToken, apiUrl } = authData;

        const listResponse = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
          method: 'POST',
          headers: {
            'Authorization': authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bucketId: process.env.B2_BUCKET_ID,
            startFileName: existingPost.videoFileKey,
            maxFileCount: 1,
            prefix: existingPost.videoFileKey
          })
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error("[DELETE /api/posts/[id]] B2 list files failed:", {
            userId: user.id,
            postId: id,
            timestamp: new Date().toISOString(),
            error: errorText,
            videoFileKey: existingPost.videoFileKey,
          });
        } else {
          const listData = await listResponse.json();
          
          if (listData.files && listData.files.length > 0) {
            const fileInfo = listData.files[0];
            
            const deleteResponse = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
              method: 'POST',
              headers: {
                'Authorization': authorizationToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName
              })
            });

            if (!deleteResponse.ok) {
              const errorText = await deleteResponse.text();
              console.error("[DELETE /api/posts/[id]] B2 file deletion failed:", {
                userId: user.id,
                postId: id,
                timestamp: new Date().toISOString(),
                error: errorText,
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName,
                videoFileKey: existingPost.videoFileKey,
              });
            } else {
              console.log("[DELETE /api/posts/[id]] B2 file deleted successfully:", {
                userId: user.id,
                postId: id,
                timestamp: new Date().toISOString(),
                fileId: fileInfo.fileId,
                fileName: fileInfo.fileName,
                videoFileKey: existingPost.videoFileKey,
              });
            }
          } else {
            console.warn("[DELETE /api/posts/[id]] File not found in B2 storage:", {
              userId: user.id,
              postId: id,
              timestamp: new Date().toISOString(),
              videoFileKey: existingPost.videoFileKey,
              message: "File may have been already deleted or never uploaded",
            });
          }
        }
      }
    } catch (b2Error) {
      console.error("[DELETE /api/posts/[id]] B2 operation error:", {
        userId: user.id,
        postId: id,
        timestamp: new Date().toISOString(),
        error: b2Error instanceof Error ? b2Error.message : "Unknown B2 error",
        errorName: b2Error instanceof Error ? b2Error.name : undefined,
        stack: b2Error instanceof Error ? b2Error.stack : undefined,
        videoFileKey: existingPost.videoFileKey,
      });
      
      // Continue execution - database deletion was successful
    }

    console.log("[DELETE /api/posts/[id]] Post deleted successfully:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      title: existingPost.title,
      videoFileKey: existingPost.videoFileKey,
    });

    return NextResponse.json(
      { message: "Post deleted successfully" },
      { status: 200 }
    );

  } catch (error) {
    console.error("[DELETE /api/posts/[id]] Database error:", {
      userId: user.id,
      postId: id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}