import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();

    // 1. Fetch Metrics
    const [
      totalScheduled,
      totalPublished,
      totalFailed,
      totalDrafts,
      socialAccounts
    ] = await Promise.all([
      prisma.post.count({
        where: { userId: user.id, status: { in: ["SCHEDULED", "PUBLISHING"] } }
      }),
      prisma.post.count({
        where: { userId: user.id, status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED"] } }
      }),
      prisma.platformPost.count({
        where: { socialAccount: { userId: user.id }, status: "FAILED" }
      }),
      prisma.post.count({
        where: { userId: user.id, status: "DRAFT" }
      }),
      prisma.socialAccount.findMany({
        where: { userId: user.id }
      })
    ]);

    const connectedNetworks = socialAccounts.length;
    const inactiveNetworks = socialAccounts.filter(s => !s.isActive).length;

    // 2. Fetch Upcoming Posts
    const upcomingPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: { in: ["SCHEDULED", "PUBLISHING"] }
      },
      orderBy: { scheduledFor: "asc" },
      take: 5,
      include: {
        platformPosts: {
          include: { socialAccount: true }
        }
      }
    });

    // 2.1. Fetch Draft Posts
    const draftPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: "DRAFT"
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        description: true,
        videoFileName: true,
        createdAt: true,
      }
    });

    // 3. Fetch Activity for the Chart (last 7 days published posts)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const recentPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED"] },
        createdAt: { gte: last7Days[0] }
      },
      select: { createdAt: true }
    });

    const chartData = last7Days.map(date => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const label = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      const count = recentPosts.filter(p => p.createdAt >= date && p.createdAt < nextDate).length;
      return { date: label, posts: count };
    });

    return NextResponse.json({
      totalScheduled,
      totalPublished,
      totalFailed,
      totalDrafts,
      connectedNetworks,
      inactiveNetworks,
      socialAccounts: socialAccounts.map(acc => ({
        id: acc.id,
        platform: acc.platform,
        isActive: acc.isActive
      })),
      upcomingPosts,
      draftPosts,
      chartData,
      userName: user.name
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
