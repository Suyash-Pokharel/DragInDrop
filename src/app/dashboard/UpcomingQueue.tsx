import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, Link2, ArrowRight, FileEdit, Trash2 } from "lucide-react";
import { useModal } from "@/app/components/ModalProvider";

import YoutubeLogo from "../assets/logo/Youtube.webp";
import InstagramLogo from "../assets/logo/Instagram.webp";
import TikTokLogo from "../assets/logo/TikTok.webp";
import FacebookLogo from "../assets/logo/Facebook.webp";
import XLogo from "../assets/logo/X.webp";
import ThreadsLogo from "../assets/logo/Threads.webp";

interface DraftPost {
  id: string;
  title: string | null;
  description: string | null;
  videoFileName: string | null;
  createdAt: Date;
}

interface UpcomingPost {
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
}

interface UpcomingQueueProps {
  draftPosts: DraftPost[];
  upcomingPosts: UpcomingPost[];
  userTimezone: string | null;
}

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

export default function UpcomingQueue({ draftPosts, upcomingPosts, userTimezone }: UpcomingQueueProps) {
  const modal = useModal();

  return (
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

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2   relative">
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
            {draftPosts.map((draft) => (
              <div key={draft.id} className="relative group">
                <div className="p-5 rounded-xl border bg-warning/10 border-warning/30 transition-all duration-300 hover:border-warning/50 hover:bg-warning/15">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3 flex-1 pr-4">
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
            
            {upcomingPosts.map((post, i) => {
              const isNext = i === 0;
              return (
                <div key={post.id} className="relative group">
                  <div className="p-5 rounded-xl border bg-background border-border transition-all duration-300 hover:border-primary/40 hover:bg-surface/50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3 flex-1 pr-4">
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
                      {formatScheduledTime(post.scheduledFor, userTimezone)}
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
  );
}
