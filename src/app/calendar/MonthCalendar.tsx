"use client";

import { useState } from "react";
import Image, { StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useModal } from "@/app/components/ModalProvider";

// --- IMPORTS --- //
import facebookLogo from "../assets/logo/Facebook.webp";
import googleLogo from "../assets/logo/Google.webp";
import instagramLogo from "../assets/logo/Instagram.webp";
import linkedinLogo from "../assets/logo/LinkedIn.webp";
import threadsLogo from "../assets/logo/Threads.webp";
import tiktokLogo from "../assets/logo/TikTok.webp";
import xLogo from "../assets/logo/X.webp";
import youtubeLogo from "../assets/logo/Youtube.webp";

// --- TYPES --- //
type Platform =
  | "Facebook"
  | "Google"
  | "Instagram"
  | "Linkedin"
  | "Threads"
  | "TikTok"
  | "X"
  | "Youtube";

interface ScheduledPost {
  id: number;
  day: number;
  month: number;
  year: number;
  platform: Platform;
}

// --- ICON MAPPING ---
const LOGO_MAP: Record<Platform, StaticImageData> = {
  Facebook: facebookLogo,
  Google: googleLogo,
  Instagram: instagramLogo,
  Linkedin: linkedinLogo,
  Threads: threadsLogo,
  TikTok: tiktokLogo,
  X: xLogo,
  Youtube: youtubeLogo,
};

// --- MOCK DATA ---
// Note: JavaScript months are 0-indexed (0 = January, 1 = February, 2 = March, 3 = April, etc.)
const MOCK_POSTS: ScheduledPost[] = [
  { id: 1, day: 8, month: 3, year: 2026, platform: "Instagram" },
  { id: 2, day: 8, month: 3, year: 2026, platform: "TikTok" },
  { id: 3, day: 11, month: 3, year: 2026, platform: "Linkedin" },
  { id: 4, day: 11, month: 3, year: 2026, platform: "X" },
  { id: 5, day: 18, month: 3, year: 2026, platform: "Facebook" },
  { id: 6, day: 21, month: 3, year: 2026, platform: "Youtube" },
  { id: 7, day: 21, month: 3, year: 2026, platform: "Google" },
  { id: 8, day: 24, month: 3, year: 2026, platform: "Threads" },
  { id: 9, day: 15, month: 3, year: 2026, platform: "Facebook" },
  { id: 10, day: 15, month: 3, year: 2026, platform: "Instagram" },
  { id: 11, day: 15, month: 3, year: 2026, platform: "TikTok" },
  { id: 12, day: 15, month: 3, year: 2026, platform: "Linkedin" },
  { id: 13, day: 15, month: 3, year: 2026, platform: "X" },
  { id: 14, day: 15, month: 3, year: 2026, platform: "Youtube" },
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// --- HELPER: Icon Group with Smart Overflow ---
const IconGroup = ({
  posts,
  limit,
  className,
}: {
  posts: ScheduledPost[];
  limit: number;
  className: string;
}) => {
  if (posts.length === 0) return null;

  // Mobile Case (limit 0): Show only a badge with the total count
  if (limit === 0) {
    return (
      <div className={`w-full ${className}`}>
        <div className="w-4 h-4 flex items-center justify-center rounded-full bg-surface-highlight text-[9px] font-bold text-text-secondary border border-border">
          +{posts.length}
        </div>
      </div>
    );
  }

  const hasOverflow = posts.length > limit;
  const visibleCount = hasOverflow ? limit - 1 : posts.length;
  const badgeCount = posts.length - visibleCount;
  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className={`flex flex-wrap gap-1 content-start ${className}`}>
      {visiblePosts.map((post) => (
        <div
          key={post.id}
          className="
            relative 
            w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 
            hover:scale-110 transition-transform cursor-pointer
          "
          title={post.platform}
        >
          <Image
            src={LOGO_MAP[post.platform]}
            alt={post.platform}
            fill
            sizes="24px"
            className="object-contain drop-shadow-sm"
          />
        </div>
      ))}

      {hasOverflow && (
        <div
          className="
            flex items-center justify-center 
            rounded-full bg-surface-highlight border border-border
            font-bold text-text-secondary
            text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs
            w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 
          "
          title={`${badgeCount} more posts`}
        >
          +{badgeCount}
        </div>
      )}
    </div>
  );
};

const MonthCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { openUpload, setSelectedDate } = useModal();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const startDayIndex = getFirstDayOfMonth(year, month);

  const prevMonthDays = getDaysInMonth(year, month - 1);
  const prevMonthPadding = Array.from(
    { length: startDayIndex },
    (_, i) => prevMonthDays - startDayIndex + i + 1,
  );
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const totalCells = 42;
  const nextMonthPadding = Array.from(
    { length: totalCells - (startDayIndex + daysInMonth) },
    (_, i) => i + 1,
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getPostsForDay = (d: number, m: number, y: number) => {
    return MOCK_POSTS.filter((p) => p.day === d && p.month === m && p.year === y);
  };

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  const isToday = (d: number) => {
    return (
      d === todayObj.getDate() && month === todayObj.getMonth() && year === todayObj.getFullYear()
    );
  };

  const isPast = (d: number, checkMonth: number, checkYear: number) => {
    const checkDate = new Date(checkYear, checkMonth, d);
    return checkDate < todayObj;
  };

  return (
    <div className="w-full max-w-7xl mx-auto text-text-main select-none">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl md:text-2xl font-bold text-text-main uppercase tracking-tight">
          {currentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 text-text-secondary hover:text-text-main hover:bg-surface-highlight rounded-xl transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-semibold bg-surface/90 backdrop-blur-md border border-border text-text-main rounded-xl shadow-sm hover:bg-surface-highlight hover:border-primary/40 transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 text-text-secondary hover:text-text-main hover:bg-surface-highlight rounded-xl transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* --- CALENDAR GRID --- */}
      <div className="flex flex-col gap-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] md:text-xs font-bold text-text-secondary tracking-wider uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr gap-2">
          {/* 1. Previous Month Padding */}
          {prevMonthPadding.map((day) => (
            <div
              key={`prev-${day}`}
              className="h-17.5 sm:h-20 lg:h-25 bg-surface/30 border border-transparent rounded-2xl p-3 md:p-4 opacity-40 flex flex-col items-start pointer-events-none"
            >
              <span className="text-xs md:text-sm font-medium text-text-secondary">{day}</span>
            </div>
          ))}

          {/* 2. Current Month Days */}
          {currentMonthDays.map((day) => {
            const posts = getPostsForDay(day, month, year);
            const today = isToday(day);
            const past = isPast(day, month, year);

            return (
              <div
                key={`curr-${day}`}
                className={`group relative h-17.5 sm:h-20 lg:h-25 rounded-2xl p-3 md:p-4 flex flex-col gap-1.5 transition-all duration-300 overflow-hidden
                  border
                  ${
                    today
                      ? "border-primary bg-primary/5 backdrop-blur-md" 
                      : "border-border/60 bg-surface/60 backdrop-blur-sm"
                  }
                  ${
                    past
                      ? "bg-background/30 opacity-60 cursor-default border-transparent"
                      : "hover:bg-surface-highlight/90 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  }
                `}
              >
                {/* Header: Date Number + Add Button */}
                <div className="flex justify-between items-start h-5 md:h-6">
                  {/* Date Number */}
                  <span
                    className={`text-xs sm:text-sm md:text-base font-semibold leading-none
                    ${
                      today
                        ? "text-primary" // Today is colored with Primary Brand Color
                        : "text-text-main"
                    }
                    ${past ? "text-text-secondary font-normal" : ""}
                  `}
                  >
                    {day}
                  </span>

                  {/* Plus Button */}
                  {!past && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Get current time
                        const now = new Date();
                        // Create date with calendar day but current time
                        const d = new Date(year, month, day, now.getHours(), now.getMinutes());
                        setSelectedDate(d);
                        openUpload();
                      }}
                      className="
                        absolute top-1.5 right-1.5 md:top-2 md:right-2
                        opacity-0 group-hover:opacity-100 transition-all duration-200
                        flex items-center justify-center
                        rounded-lg
                        bg-surface border border-border
                        text-text-secondary shadow-sm
                        hover:text-primary hover:border-primary
                        /* Sizes strictly matched to date number size */
                        w-5 h-5 md:w-7 md:h-7
                      "
                      title="Schedule Post"
                    >
                      <Plus className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" strokeWidth={3} />
                    </button>
                  )}
                </div>

                {/* --- RESPONSIVE ICON GROUPS --- */}
                <IconGroup posts={posts} limit={0} className="flex sm:hidden" />
                <IconGroup posts={posts} limit={3} className="hidden sm:flex md:hidden" />
                <IconGroup posts={posts} limit={4} className="hidden md:flex lg:hidden" />
                <IconGroup posts={posts} limit={6} className="hidden lg:flex" />
              </div>
            );
          })}

          {/* 3. Next Month Padding */}
          {nextMonthPadding.map((day) => (
            <div
              key={`next-${day}`}
              className="h-17.5 sm:h-20 lg:h-25 bg-surface/30 border border-transparent rounded-2xl p-3 md:p-4 opacity-40 flex flex-col items-start pointer-events-none"
            >
              <span className="text-xs md:text-sm font-medium text-text-secondary">{day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;
