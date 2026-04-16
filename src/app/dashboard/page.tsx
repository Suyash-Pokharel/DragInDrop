"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  Link2, 
  Plus, 
  AlertTriangle,
  ArrowRight,
  FileEdit,
  Trash2
} from "lucide-react";
import DashboardActivityChart from "./DashboardActivityChart";
import Image from "next/image";
import { useModal } from "@/app/components/ModalProvider";

import YoutubeLogo from "../assets/logo/Youtube.webp";
import InstagramLogo from "../assets/logo/Instagram.webp";
import TikTokLogo from "../assets/logo/TikTok.webp";
import FacebookLogo from "../assets/logo/Facebook.webp";
import XLogo from "../assets/logo/X.webp";
import ThreadsLogo from "../assets/logo/Threads.webp";

// Helper for converting UTC time to user's timezone
const formatScheduledTime = (utcDate: Date, timezone: string | null): string => {
  const date = new Date(utcDate);
  const userTimezone = timezone || 'UTC';
  
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: userTimezone
  });
};

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

type DashboardData = {
  totalScheduled: number;
  totalPublished: number;
  totalFailed: number;
  totalDrafts: number;
  connectedNetworks: number;
  inactiveNetworks: number;
  socialAccounts: Array<{
    id: string;
    platform: string;
    isActive: boolean;
  }>;
  upcomingPosts: Array<{
    id: string;
    title: string | null;
    status: string;
    scheduledFor: Date;
    platformPosts: Array<{
      id: string;
      socialAccount: {
        platform: string;
      };
    }>;
  }>;
  draftPosts: Array<{
    id: string;
    title: string | null;
    description: string | null;
    videoFileName: string | null;
    createdAt: Date;
  }>;
  chartData: Array<{
    date: string;
    posts: number;
  }>;
  userName: string;
};

type UserPreferences = {
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  timezone: string | null;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const modal = useModal();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }

    if (status === "authenticated" && session?.user) {
      // Fetch dashboard data and user preferences in parallel
      Promise.all([
        fetch("/api/dashboard").then(res => res.json()),
        fetch("/api/user/preferences").then(res => res.json())
      ])
        .then(([dashboardData, preferences]) => {
          console.log("Dashboard data received:", dashboardData);
          console.log("Preferences received:", preferences);
          
          // Check if API returned an error
          if (dashboardData.error) {
            console.error("Dashboard API error:", dashboardData.error);
            setError(dashboardData.error);
            setLoading(false);
            return;
          }
          
          setDashboardData(dashboardData);
          setUserPreferences(preferences);
          setLoading(false);
        })
        .catch(error => {
          console.error("Failed to fetch dashboard data:", error);
          setError(error.message || "Failed to load dashboard");
          setLoading(false);
        });
    }
  }, [status, session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h3 className="text-xl font-bold text-text-main mb-2">Failed to Load Dashboard</h3>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const {
    totalScheduled = 0,
    totalPublished = 0,
    totalFailed = 0,
    totalDrafts = 0,
    connectedNetworks = 0,
    inactiveNetworks = 0,
    socialAccounts = [],
    upcomingPosts = [],
    draftPosts = [],
    chartData = [],
    userName
  } = dashboardData;

  return (
    <div className="space-y-10 pb-16 load-step-2 relative">
      
      {/* Ambient Background Glows - Enhanced for better visibility */}
      <div className="absolute top-0 left-1/4 w-full max-w-[100vw] h-[400px] bg-primary/20 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[500px] right-0 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[200px] left-0 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

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
            Welcome back, {userName?.split(" ")[0] || "Creator"}.
          </h2>
          <p className="text-text-secondary mt-2 text-lg">Here&apos;s your command center overview for today.</p>
        </div>
        <div className="flex w-full md:w-auto">
          <button 
            onClick={() => modal.openUpload()}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-glow hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Create New Post</span>
          </button>
        </div>
      </div>

      {/* High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
        {/* Card 1 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <h3 className="text-4xl font-black text-text-main mb-1">{totalScheduled}</h3>
          <p className="text-text-secondary text-sm font-medium">Scheduled Posts</p>
        </div>

        {/* Card 2 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-success/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-success/10 rounded-full blur-2xl group-hover:bg-success/20 transition-colors"></div>
          <h3 className="text-4xl font-black text-text-main mb-1">{totalPublished}</h3>
          <p className="text-text-secondary text-sm font-medium">Successfully Published</p>
        </div>

        {/* Card 3 */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-error/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-error/10 rounded-full blur-2xl group-hover:bg-error/20 transition-colors"></div>
          <div className="flex items-end gap-3 mb-1">
            <h3 className="text-4xl font-black text-text-main">{totalFailed}</h3>
            {totalFailed > 0 && <span className="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-xl mb-2">Needs Attention</span>}
          </div>
          <p className="text-text-secondary text-sm font-medium">Failed Attempts</p>
        </div>

        {/* Card 4 - Draft Posts */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-warning/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-warning/10 rounded-full blur-2xl group-hover:bg-warning/20 transition-colors"></div>
          <h3 className="text-4xl font-black text-text-main mb-1">{totalDrafts}</h3>
          <p className="text-text-secondary text-sm font-medium">Draft Posts</p>
        </div>

        {/* Card 5 - Connected Networks */}
        <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-text-secondary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-4xl font-black text-text-main">{connectedNetworks}</h3>
            {inactiveNetworks > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-xl">
                <AlertTriangle size={14} /> {inactiveNetworks} Auth Expired
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm font-medium">Connected Networks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 relative z-10">
        
        {/* Main Column: Activity Graph & Platform Health */}
        <div className="xl:col-span-3 space-y-8">
          
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
                Connected Platforms
              </h3>
              <Link href="/settings/social-accounts" className="text-sm font-semibold text-primary hover:text-secondary flex items-center gap-1 group-hover:underline">
                Manage All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {socialAccounts.length === 0 ? (
              <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-surface-highlight rounded-full flex items-center justify-center">
                  <Link2 className="w-8 h-8 text-text-secondary opacity-50" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-text-main">No integrations yet</h4>
                  <p className="text-sm text-text-secondary mt-1 max-w-md">Connect your TikTok, YouTube, or Instagram accounts to start scheduling videos.</p>
                </div>
                <Link href="/settings/social-accounts" className="mt-2 text-sm font-bold bg-text-main text-surface px-6 py-2.5 rounded-xl hover:scale-105 transition-transform shadow-glow">
                  Connect Platforms
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {socialAccounts.map((acc) => (
                  <div key={acc.id} className="group/acc relative p-4 bg-surface-highlight/50 hover:bg-surface-highlight border border-border hover:border-primary/30 rounded-xl transition-all duration-300">
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
        <div className="xl:col-span-2">
          <section className="bg-surface/80 backdrop-blur-xl border border-border p-6 md:p-8 rounded-[2rem] shadow-sm max-h-[720px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                  <Calendar className="text-primary w-6 h-6" />
                  Upcoming Queue
                </h3>
                <p className="text-sm text-text-secondary mt-1">Drafts and scheduled posts</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative">
              {draftPosts.length === 0 && upcomingPosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10 opacity-70">
                  <div className="w-20 h-20 bg-background border border-border rounded-full flex items-center justify-center shadow-sm">
                    <Calendar className="w-8 h-8 text-text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-main">Queue is entirely empty.</h4>
                    <p className="text-sm text-text-secondary mt-1">All caught up! Time to create some new content or drafts.</p>
                  </div>
                  <button 
                    onClick={() => modal.openUpload()}
                    className="text-sm font-bold text-primary hover:text-secondary underline underline-offset-4"
                  >
                    Schedule new video
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Render Draft Posts First */}
                  {draftPosts.map((draft) => (
                    <div key={draft.id} className="relative group">
                      {/* Draft Card */}
                      <div className="p-5 rounded-xl border bg-warning/10 border-warning/30 transition-all duration-300 hover:border-warning/50 hover:bg-warning/15">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3 flex-1 pr-4">
                            {/* Blinking Indicator for drafts - warning color with reduced opacity */}
                            <div className="relative flex h-3 w-3 shrink-0">
                              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-warning opacity-30"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
                            </div>
                            <h4 className="font-bold text-sm text-text-main line-clamp-2 leading-relaxed">
                              {draft.title || "Untitled Draft"}
                            </h4>
                          </div>
                          <span className="shrink-0 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-warning text-white shadow-sm">
                            DRAFT
                          </span>
                        </div>
                        
                        {draft.description && (
                          <p className="text-xs text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                            {draft.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pt-3 border-t border-warning/20">
                          <span className="text-xs text-text-secondary font-medium">
                            Not Scheduled
                          </span>
                          <div className="flex items-center gap-2 sm:flex-row flex-col sm:gap-2 gap-1">
                            <button 
                              className="sm:w-8 sm:h-8 w-full h-10 rounded-full bg-warning/10 hover:bg-warning hover:text-white flex items-center justify-center text-warning transition-colors cursor-pointer border border-warning/20 shadow-sm min-h-[44px] sm:min-h-[32px]"
                              aria-label="Edit draft post"
                              onClick={() => {
                                modal.openEditPost(draft.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  modal.openEditPost(draft.id);
                                }
                              }}
                              tabIndex={0}
                            >
                              <FileEdit size={14} />
                            </button>
                            <button 
                              className="sm:w-8 sm:h-8 w-full h-10 rounded-full bg-error/10 hover:bg-error hover:text-white flex items-center justify-center text-error transition-colors cursor-pointer border border-error/20 shadow-sm min-h-[44px] sm:min-h-[32px]"
                              aria-label="Delete draft post"
                              onClick={() => {
                                modal.openDeleteConfirmation(draft.id, draft.title || "Untitled Draft");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  modal.openDeleteConfirmation(draft.id, draft.title || "Untitled Draft");
                                }
                              }}
                              tabIndex={0}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Render Scheduled Posts Below */}
                  {upcomingPosts.map((post, i) => {
                    const isNext = i === 0; // Highlight the very next post
                    return (
                      <div key={post.id} className="relative group">
                        {/* Content Card */}
                        <div className="p-5 rounded-xl border bg-background border-border transition-all duration-300 hover:border-primary/40 hover:bg-surface/50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3 flex-1 pr-4">
                              {/* Blinking Indicator - positioned to the left of title */}
                              {isNext && (
                                <div className="relative flex h-3 w-3 shrink-0">
                                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-primary opacity-30"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </div>
                              )}
                              <h4 className="font-bold text-sm text-text-main line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                                {post.title || "Untitled Video"}
                              </h4>
                            </div>
                            <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${isNext ? 'bg-primary text-white' : 'bg-surface-highlight text-text-secondary border border-border'}`}>
                              {post.status.replace("_", " ")}
                            </div>
                          </div>
                          
                          <div className="flex items-center text-xs font-semibold text-text-secondary mb-4 bg-surface-highlight/50 w-fit px-3 py-1.5 rounded-xl border border-border shadow-inner">
                            <Clock size={14} className="mr-2 text-primary" />
                            {formatScheduledTime(post.scheduledFor, userPreferences?.timezone || null)}
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
                            
                            <div className="flex items-center gap-2 sm:flex-row flex-col sm:gap-2 gap-1">
                              <button 
                                className="sm:w-8 sm:h-8 w-full h-10 rounded-full bg-primary/10 hover:bg-primary hover:text-white flex items-center justify-center text-primary transition-colors cursor-pointer border border-primary/20 shadow-sm min-h-[44px] sm:min-h-[32px]"
                                aria-label="Edit scheduled post"
                                onClick={() => {
                                  modal.openEditPost(post.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    modal.openEditPost(post.id);
                                  }
                                }}
                                tabIndex={0}
                              >
                                <FileEdit size={14} />
                              </button>
                              <button 
                                className="sm:w-8 sm:h-8 w-full h-10 rounded-full bg-error/10 hover:bg-error hover:text-white flex items-center justify-center text-error transition-colors cursor-pointer border border-error/20 shadow-sm min-h-[44px] sm:min-h-[32px]"
                                aria-label="Delete scheduled post"
                                onClick={() => {
                                  modal.openDeleteConfirmation(post.id, post.title || "Untitled Post");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    modal.openDeleteConfirmation(post.id, post.title || "Untitled Post");
                                  }
                                }}
                                tabIndex={0}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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
