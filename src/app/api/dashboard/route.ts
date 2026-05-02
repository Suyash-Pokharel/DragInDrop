import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    console.log("[Dashboard API] User:", user ? `${user.id} (${user.email})` : "null");

    if (!user) {
      console.log("[Dashboard API] Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();

    // 1. Fetch Metrics
    const [totalScheduled, totalPublished, totalFailed, totalDrafts, socialAccounts] =
      await Promise.all([
        prisma.post.count({
          where: { userId: user.id, status: { in: ["SCHEDULED", "PUBLISHING"] } },
        }),
        prisma.post.count({
          where: { userId: user.id, status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED"] } },
        }),
        prisma.platformPost.count({
          where: {
            SocialAccount: {
              userId: user.id,
            },
            status: "FAILED",
          },
        }),
        prisma.post.count({
          where: { userId: user.id, status: "DRAFT" },
        }),
        prisma.socialAccount.findMany({
          where: { userId: user.id },
        }),
      ]);

    console.log("[Dashboard API] Metrics:", {
      totalScheduled,
      totalPublished,
      totalFailed,
      totalDrafts,
      socialAccountsCount: socialAccounts.length,
    });

    const connectedNetworks = socialAccounts.length;
    const inactiveNetworks = socialAccounts.filter((s) => !s.isActive).length;

    // 2. Fetch Upcoming Posts (including failed posts)
    const upcomingPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: { in: ["SCHEDULED", "PUBLISHING", "FAILED", "PARTIALLY_PUBLISHED"] },
      },
      orderBy: { scheduledFor: "asc" },
      take: 5,
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

    // 2.1. Fetch Draft Posts
    const draftPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: "DRAFT",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        description: true,
        videoFileName: true,
        createdAt: true,
      },
    });

    // 3. Fetch Activity for the Chart (last 7 days - all posts including scheduled)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const recentPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED", "SCHEDULED", "PUBLISHING"] },
        createdAt: { gte: last7Days[0] },
      },
      select: { createdAt: true },
    });

    const chartData = last7Days.map((date) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const label = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      const count = recentPosts.filter((p) => p.createdAt >= date && p.createdAt < nextDate).length;
      return { date: label, posts: count };
    });

    const responseData = {
      totalScheduled,
      totalPublished,
      totalFailed,
      totalDrafts,
      connectedNetworks,
      inactiveNetworks,
      socialAccounts: socialAccounts.map((acc) => ({
        id: acc.id,
        platform: acc.platform,
        isActive: acc.isActive,
      })),
      upcomingPosts: upcomingPosts.map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        scheduledFor: post.scheduledFor,
        platformPosts: post.PlatformPost.map((pp) => ({
          id: pp.id,
          socialAccount: {
            platform: pp.SocialAccount.platform,
          },
        })),
      })),
      draftPosts,
      chartData,
      userName: user.name,
    };

    console.log("[Dashboard API] Response data:", JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
