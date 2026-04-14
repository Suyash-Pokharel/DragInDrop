import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  BarChart3, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Link2, 
  Plus, 
  XOctagon,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import DashboardActivityChart from "./DashboardActivityChart";
import Image from "next/image";

import YoutubeLogo from "../assets/logo/Youtube.webp";
import InstagramLogo from "../assets/logo/Instagram.webp";
import TikTokLogo from "../assets/logo/TikTok.webp";
import FacebookLogo from "../assets/logo/Facebook.webp";
import XLogo from "../assets/logo/X.webp";
import ThreadsLogo from "../assets/logo/Threads.webp";

// Helper for platform icons
const getPlatformIcon = (platform: string, className = "w-5 h-5") => {
  let src;
  switch (platform.toLowerCase()) {
    case "youtube": src = YoutubeLogo; break;
    case "instagram": src = InstagramLogo; break;
    case "facebook": src = FacebookLogo; break;
    case "x": 
    case "twitter": src = XLogo; break;
    case "tiktok": src = TikTokLogo; break;
    case "threads": src = ThreadsLogo; break;
    default: return <Link2 className={className + " text-text-secondary"} />;
  }
  return (
    <div className={`relative ${className}`}>
        <Image src={src} alt={platform} fill sizes="40px" className="object-contain drop-shadow-sm" />
    </div>
  );
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const prisma = getPrisma();

  // 1. Fetch Metrics
  const [
    totalScheduled,
    totalPublished,
    totalFailed,
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

  return (
    <div className="space-y-10 pb-16 load-step-2 relative">
      
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-full h-[400px] bg-primary/15 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[500px] right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-highlight border border-border rounded-full text-xs font-semibold text-text-secondary tracking-wider uppercase mb-4 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            System Online
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text-main to-text-secondary">
            Welcome back, {user.name?.split(" ")[0] || "Creator"}.
          </h2>
          <p className="text-text-secondary mt-2 text-lg">Here's your command center overview for today.</p>
        </div>
        <div className="flex w-full md:w-auto">
          <Link 
            href="/upload" 
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-glow hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Create New Post</span>
          </Link>
        </div>
      </div>

      {/* High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {/* Card 1 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:shadow-glow transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
              <Clock size={24} strokeWidth={2.5} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-text-main mb-1">{totalScheduled}</h3>
          <p className="text-text-secondary text-sm font-medium">Scheduled Posts</p>
        </div>

        {/* Card 2 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-success/50 hover:shadow-[0_0_30px_-5px_var(--success)] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-success/10 rounded-full blur-2xl group-hover:bg-success/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center text-success border border-success/20 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={24} strokeWidth={2.5} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-text-main mb-1">{totalPublished}</h3>
          <p className="text-text-secondary text-sm font-medium">Successfully Published</p>
        </div>

        {/* Card 3 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-error/50 hover:shadow-[0_0_30px_-5px_var(--error)] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-error/10 rounded-full blur-2xl group-hover:bg-error/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-error/20 to-error/5 flex items-center justify-center text-error border border-error/20 group-hover:scale-110 transition-transform">
              <XOctagon size={24} strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1">
            <h3 className="text-4xl font-black text-text-main">{totalFailed}</h3>
            {totalFailed > 0 && <span className="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-md mb-2">Needs Attention</span>}
          </div>
          <p className="text-text-secondary text-sm font-medium">Failed Attempts</p>
        </div>

        {/* Card 4 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-text-secondary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-text-secondary/20 to-text-secondary/5 flex items-center justify-center text-text-main border border-text-secondary/20 group-hover:scale-110 transition-transform group-hover:text-primary group-hover:border-primary/30 group-hover:from-primary/20 group-hover:to-primary/5">
              <Link2 size={24} strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-4xl font-black text-text-main">{connectedNetworks}</h3>
            {inactiveNetworks > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-md">
                <AlertTriangle size={14} /> {inactiveNetworks} Auth Expired
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm font-medium">Connected Networks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative z-10">
        
        {/* Main Column: Activity Graph & Platform Health */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Chart Section */}
          <section className="bg-surface/50 backdrop-blur-xl border border-border p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                  <BarChart3 className="text-primary w-6 h-6" />
                  Publishing Activity
                </h3>
                <p className="text-sm text-text-secondary mt-1">Your automated pipeline success rate</p>
              </div>
              <span className="text-xs font-bold text-text-secondary bg-surface border border-border px-4 py-1.5 rounded-full shadow-sm">Last 7 Days</span>
            </div>
            
            <DashboardActivityChart data={chartData} />
          </section>

          {/* Platform Connections Banner */}
          <section className="bg-gradient-to-br from-surface to-background border border-border p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                <Link2 className="text-primary w-6 h-6" />
                Active Integrations
              </h3>
              <Link href="/settings/social-accounts" className="text-sm font-semibold text-primary hover:text-secondary flex items-center gap-1 group-hover:underline">
                Manage All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {socialAccounts.length === 0 ? (
              <div className="bg-surface border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-surface-highlight rounded-full flex items-center justify-center">
                  <Link2 className="w-8 h-8 text-text-secondary opacity-50" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-text-main">No integrations yet</h4>
                  <p className="text-sm text-text-secondary mt-1 max-w-md">Connect your TikTok, YouTube, or Instagram accounts to start scheduling videos.</p>
                </div>
                <Link href="/settings/social-accounts" className="mt-2 text-sm font-bold bg-text-main text-surface px-6 py-2.5 rounded-xl hover:scale-105 transition-transform shadow-lg">
                  Connect Platforms
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {socialAccounts.map((acc) => (
                  <div key={acc.id} className="group/acc relative p-4 bg-surface-highlight/50 hover:bg-surface-highlight border border-border hover:border-text-secondary/30 rounded-2xl transition-all duration-300">
                    <div className="absolute top-3 right-3">
                      <span className={`block w-2.5 h-2.5 rounded-full shadow-sm ${acc.isActive ? 'bg-success shadow-[0_0_8px_var(--success)]' : 'bg-error shadow-[0_0_8px_var(--error)]'}`}></span>
                    </div>
                    <div className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center ${acc.isActive ? 'bg-background text-text-main shadow-sm' : 'bg-error/10 text-error'}`}>
                      {getPlatformIcon(acc.platform, "w-6 h-6")}
                    </div>
                    <p className="text-sm font-bold text-text-main capitalize">{acc.platform}</p>
                    <p className="text-[11px] font-medium text-text-secondary mt-0.5">
                      {acc.isActive ? "Connected & Active" : "Requires Re-Auth"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Side Column: Timeline */}
        <div className="xl:col-span-1">
          <section className="bg-surface/80 backdrop-blur-xl border border-border p-6 md:p-8 rounded-[2rem] shadow-sm h-full max-h-[850px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                  <Calendar className="text-primary w-6 h-6" />
                  Upcoming Queue
                </h3>
                <p className="text-sm text-text-secondary mt-1">Your automated timeline</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative">
              {upcomingPosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10 opacity-70">
                  <div className="w-20 h-20 bg-background border border-border rounded-full flex items-center justify-center shadow-sm">
                    <Calendar className="w-8 h-8 text-text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-main">Queue is entirely empty.</h4>
                    <p className="text-sm text-text-secondary mt-1">All caught up! Time to create some new content.</p>
                  </div>
                  <Link href="/upload" className="text-sm font-bold text-primary hover:text-secondary underline underline-offset-4">
                    Schedule new video
                  </Link>
                </div>
              ) : (
                <div className="relative pl-4 space-y-8 before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
                  {upcomingPosts.map((post, i) => {
                    const isNext = i === 0; // Highlight the very next post
                    return (
                      <div key={post.id} className="relative group">
                        {/* Timeline Node */}
                        <div className="absolute -left-[5px] top-1.5 z-10 flex items-center justify-center">
                          <div className={`w-4 h-4 rounded-full border-4 border-surface ${isNext ? 'bg-primary shadow-[0_0_12px_var(--primary)] animate-pulse' : 'bg-text-secondary/50 group-hover:bg-text-main transition-colors'}`}></div>
                        </div>

                        {/* Content Card */}
                        <div className={`ml-6 p-5 rounded-2xl border transition-all duration-300 ${isNext ? 'bg-surface border-primary/40 shadow-glow' : 'bg-background border-border hover:border-text-secondary/30 hover:-translate-y-1 hover:shadow-lg'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-sm text-text-main line-clamp-2 pr-4 leading-relaxed group-hover:text-primary transition-colors">
                              {post.title || "Untitled Video"}
                            </h4>
                            <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${isNext ? 'bg-primary text-white' : 'bg-surface-highlight text-text-secondary border border-border'}`}>
                              {post.status.replace("_", " ")}
                            </div>
                          </div>
                          
                          <div className="flex items-center text-xs font-semibold text-text-secondary mb-4 bg-surface-highlight/50 w-fit px-3 py-1.5 rounded-lg border border-border shadow-inner">
                            <Clock size={14} className="mr-2 text-primary" />
                            {new Date(post.scheduledFor).toLocaleString("en-US", {
                              weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            })}
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-border">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Platforms:</span>
                              <div className="flex -space-x-2 relative z-0">
                                {post.platformPosts.slice(0, 4).map((pp) => (
                                  <div key={pp.id} className="w-7 h-7 rounded-full bg-surface border-2 border-background flex items-center justify-center text-text-main shadow-sm hover:z-20 hover:scale-110 transition-transform cursor-help" title={pp.socialAccount.platform}>
                                    {getPlatformIcon(pp.socialAccount.platform, "w-3.5 h-3.5")}
                                  </div>
                                ))}
                                {post.platformPosts.length > 4 && (
                                  <div className="w-7 h-7 rounded-full bg-surface-highlight border-2 border-background flex items-center justify-center text-[10px] font-bold text-text-secondary z-0 shadow-sm">
                                    +{post.platformPosts.length - 4}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Link href={`/calendar`} className="w-8 h-8 rounded-full bg-surface-highlight flex items-center justify-center text-text-secondary hover:bg-primary hover:text-white transition-colors cursor-pointer border border-border shadow-sm">
                              <ArrowRight size={14} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {upcomingPosts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border text-center">
                <Link href="/calendar" className="text-sm font-bold text-primary flex items-center justify-center gap-2 hover:gap-3 transition-all">
                  Open Full Calendar <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
