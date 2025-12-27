"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image, { StaticImageData } from "next/image";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  Bell,
  Moon,
  Sun,
  Upload,
  LayoutDashboard,
  Calendar,
  LogOut,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import PricingPopup from "../pricing/PricingPopup";

interface NavbarProps {
  imageSrc?: string | StaticImageData;
  isAdmin?: boolean; 
}

const NOTIFICATIONS = [
  {
    id: 1,
    title: "New file uploaded",
    desc: "John uploaded 'Q3_Report.pdf'",
    time: "1 min ago",
    unread: true,
  },
  {
    id: 2,
    title: "System Update",
    desc: "Server maintenance scheduled",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    title: "Meeting Reminder",
    desc: "Team sync at 3:00 PM",
    time: "2 hours ago",
    unread: false,
  },
  {
    id: 4,
    title: "Welcome!",
    desc: "Thanks for joining DragInDrop",
    time: "1 day ago",
    unread: false,
  },
  {
    id: 5,
    title: "Storage Warning",
    desc: "You used 80% of storage",
    time: "2 days ago",
    unread: true,
  },
];

const UserNavbar = ({ imageSrc, isAdmin = false }: NavbarProps) => {
  const pathname = usePathname();
  // Change: Add state to control modal visibility
  const [showPricingPopup, setShowPricingPopup] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<
    "notifications" | "profile" | null
  >(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayImage =
    imageSrc ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";

  const toggleDropdown = (menu: "notifications" | "profile") => {
    if (activeDropdown === menu) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(menu);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        profileRef.current &&
        !profileRef.current.contains(target) &&
        notifRef.current &&
        !notifRef.current.contains(target)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (pathname === "/login" || pathname === "/register" || pathname === "/pricing" || pathname === "/createpassword" || pathname === "/contactus") {
    return null;
  }

  return (
    <nav
      className="w-full flex items-center justify-between transition-colors duration-300 ease-in-out relative z-50
        h-16 xl:h-20 2xl:h-24 px-4 md:px-8 2xl:px-12 bg-surface border-b border-border text-text-main select-none"
    >
      {/* --- LEFT SIDE --- */}
      <div className="flex items-center gap-1 md:gap-7 2xl:gap-11">
        <Link href="/" className="cursor-pointer">
          <div
            className="font-bold tracking-relaxed whitespace-nowrap text-primary
              text-xl md:text-2xl xl:text-3xl 2xl:text-4xl hover:text-secondary transition-colors"
          >
            DragInDrop
          </div>
        </Link>

        <button
          className="font-medium border rounded-md border-border transition-all active:scale-95 text-xs md:text-sm xl:text-lg 2xl:text-xl
            px-3 py-1 md:px-4 md:py-1.5 xl:px-6 xl:py-2 bg-background text-text-secondary hover:bg-surface-highlight hover:text-text-main"
        >
          SUYASH
        </button>
      </div>

      {/* --- RIGHT SIDE --- */}
      <div className="flex items-center gap-3 md:gap-5 xl:gap-8 2xl:gap-10">
        {/* ================= NOTIFICATIONS ================= */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => toggleDropdown("notifications")}
            className={`transition-all duration-200 p-1 relative active:scale-90
              ${activeDropdown === "notifications"
                ? "text-primary"
                : "text-text-secondary hover:text-text-main"
              }
            `}
            aria-label="Notifications"
          >
            <Bell
              strokeWidth={2}
              className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9"
            />
            {/* Unread Badge (Using 'error' color from globals) */}
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error border border-surface"></span>
          </button>

          {activeDropdown === "notifications" && (
            <div
              className="absolute -right-15 md:right-0 shadow-xl rounded-lg border 
                top-12 xl:top-16 2xl:top-20
                w-72 md:w-80 xl:w-96 2xl:w-md
                animate-in fade-in zoom-in-95 duration-100 origin-top-right
                overflow-hidden
                /* Dropdown Styling */
                bg-surface border-border"
            >
              <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-surface-highlight">
                <span className="font-semibold text-text-main text-sm xl:text-base">
                  Notifications
                </span>
                <button className="text-xs text-primary hover:text-secondary transition-colors">
                  Mark all read
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {NOTIFICATIONS.map((note) => (
                  <div
                    key={note.id}
                    className={`px-4 py-3 flex gap-3 transition-colors cursor-pointer border-b border-border last:border-0
                      ${note.unread
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-surface-highlight"
                      }`}
                  >
                    <div className="mt-1 text-primary">
                      {note.title.includes("Update") ? (
                        <CheckCircle size={18} />
                      ) : note.title.includes("Warning") ? (
                        <AlertCircle size={18} className="text-warning" />
                      ) : (
                        <MessageSquare size={18} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm xl:text-base font-medium text-text-main">
                        {note.title}
                      </p>
                      <p className="text-xs xl:text-sm text-text-secondary mt-0.5">
                        {note.desc}
                      </p>
                      <p className="text-[10px] xl:text-xs text-text-secondary/70 mt-1">
                        {note.time}
                      </p>
                    </div>
                    {note.unread && (
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================= THEME TOGGLE ================= */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="transition-all duration-200 active:scale-90 p-1 text-text-secondary hover:text-text-main"
          aria-label="Toggle Theme"
        >
          {mounted && theme === "dark" ? (
            <Moon
              strokeWidth={2}
              className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9"
            />
          ) : (
            <Sun
              strokeWidth={2}
              className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9"
            />
          )}
        </button>

        {/* Vertical Separator */}
        <div className="w-px mx-1 h-6 xl:h-8 2xl:h-10 bg-border"></div>

        {/* ================= PROFILE AREA ================= */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => toggleDropdown("profile")}
            className={`relative rounded-full overflow-hidden border transition-all duration-200 active:scale-95
              w-8 h-8 md:w-9 md:h-9 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14
              bg-background
              ${activeDropdown === "profile"
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-text-secondary"
              }
            `}
          >
            <Image
              src={displayImage}
              alt="User Profile"
              fill
              priority={true}
              className="object-cover"
              sizes="(max-width: 768px) 32px, (max-width: 1280px) 48px, 64px"
            />
          </button>

          {activeDropdown === "profile" && (
            <div
              className="absolute right-0 shadow-xl rounded-lg border py-1 xl:py-2
                top-12 xl:top-16 2xl:top-20
                w-48 xl:w-64 2xl:w-72
                animate-in fade-in zoom-in-95 duration-100 origin-top-right
                /* Dropdown Styling using globals */
                bg-surface border-border"
            >
              <div className="flex flex-col text-sm xl:text-lg 2xl:text-xl text-text-secondary">
                
                {isAdmin && (
                  <>
                    <Link
                      href="/admin/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main"
                    >
                      <LayoutDashboard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-primary" />
                      <span className="font-semibold text-primary">Admin Panel</span>
                    </Link>
                    <Link
                      href="/admin/statistics"
                      className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main"
                    >
                      {/* You might need to import 'BarChart' or similar from lucide-react */}
                      <LayoutDashboard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" /> 
                      <span>Statistics</span>
                    </Link>
                    <div className="h-px w-full my-1 bg-border"></div>
                  </>
                )}

                <a
                  href="#"
                  className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main"
                >
                  <Upload className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Upload</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main"
                >
                  <LayoutDashboard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Dashboard</span>
                </a>

                {/* Linked Calendar */}
                <Link
                  href="/calendar"
                  className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main"
                >
                  <Calendar className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Calendar</span>
                </Link>

                {/* Change: Clickable div to open Pricing Modal */}
                <div
                  onClick={() => {
                    setShowPricingPopup(true);
                    setActiveDropdown(null);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 xl:py-3 transition-colors hover:bg-surface-highlight hover:text-text-main cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Pricing</span>
                </div>

                <div className="h-px w-full my-1 bg-border"></div>

                <button
                  className="flex items-center gap-3 px-4 py-2.5 xl:py-3 w-full text-left transition-colors 
                    text-error hover:bg-error/10 hover:text-error"
                  onClick={() => console.log("Logging out...")}
                >
                  <LogOut className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showPricingPopup && (
        <PricingPopup onClose={() => setShowPricingPopup(false)} />
      )}
    </nav>
  );
};

export default UserNavbar;
