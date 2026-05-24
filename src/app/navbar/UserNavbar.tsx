"use client";

import { useState, useRef, useEffect } from "react";
import Image, { StaticImageData } from "next/image";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
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
  BarChart3,
  Settings,
} from "lucide-react";
import PricingPopup from "../pricing/PricingPopup";
import { useModal } from "../components/ModalProvider";
import { useUser } from "../components/UserProvider";
import { PublicUser } from "@/lib/getCurrentUser";
import NotificationDropdown from "@/components/NotificationDropdown";
import UnreadBadge from "@/components/UnreadBadge";

interface NavbarProps {
  imageSrc?: string | StaticImageData;
  isAdmin?: boolean;
  user?: PublicUser | null;
}

const UserNavbar = ({ imageSrc, isAdmin = false, user }: NavbarProps) => {
  // Change: Add state to control modal visibility
  const [showPricingPopup, setShowPricingPopup] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<"notifications" | "profile" | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDropdownKey, setNotificationDropdownKey] = useState(0);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Get fresh session data for role verification
  const { data: session } = useSession();

  // modal context
  const modal = useModal();
  const { tempImage } = useUser();

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayImage =
    tempImage ||
    user?.image ||
    imageSrc ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";

  // Compute isAdmin from fresh session data with fallback to prop
  const isAdminFromSession = session?.user?.role === "ADMIN";
  const isAdminUser = isAdminFromSession || isAdmin;

  const toggleDropdown = (menu: "notifications" | "profile") => {
    if (activeDropdown === menu) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(menu);
    }
  };

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      const data = await response.json();
      const unread = data.notifications.filter((n: { isRead: boolean }) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("[UserNavbar] Failed to fetch unread count:", error);
    }
  };

  // Handle notification read event to update unread count
  const handleNotificationRead = () => {
    fetchUnreadCount();
    // Force re-render of NotificationDropdown by changing key
    setNotificationDropdownKey((prev) => prev + 1);
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
    
    // Fetch unread count on mount
    fetchUnreadCount();
    
    // Poll for unread count every 30 seconds
    const pollInterval = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      clearInterval(pollInterval);
    };
  }, []);

  // Route-hiding is handled by Navbar.tsx — UserNavbar only renders on authenticated pages.

  return (
    <nav
      className="w-full flex items-center justify-between transition-colors duration-300 ease-in-out sticky top-0 z-50
        h-16 xl:h-20 2xl:h-24 px-4 md:px-8 2xl:px-12 bg-surface/85 backdrop-blur-xl border-b border-border/60 text-text-main select-none shadow-sm"
    >
      {/* --- LEFT SIDE --- */}
      <div className="flex items-center gap-1 md:gap-7 2xl:gap-11">
        <Link href="/dashboard" className="cursor-pointer">
          <div
            className="font-bold tracking-relaxed whitespace-nowrap text-primary
              text-xl md:text-2xl xl:text-3xl 2xl:text-4xl hover:text-secondary transition-colors"
          >
            DragInDrop
          </div>
        </Link>

        <button
          className="font-bold border rounded-xl border-border/60 transition-all active:scale-95 text-xs md:text-sm xl:text-sm 2xl:text-base
            px-3 py-1 md:px-4 md:py-1.5 xl:px-6 xl:py-2 bg-background/50 backdrop-blur-md text-text-main hover:bg-surface-highlight hover:border-primary/40 shadow-sm"
        >
          {user?.name?.split(" ")[0]?.toUpperCase() || "USER"}
        </button>
      </div>

      {/* --- RIGHT SIDE --- */}
      <div className="flex items-center gap-3 md:gap-5 xl:gap-8 2xl:gap-10">
        {/* ================= NOTIFICATIONS ================= */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => toggleDropdown("notifications")}
            className={`transition-all duration-200 p-1 relative active:scale-90
              ${
                activeDropdown === "notifications"
                  ? "text-primary"
                  : "text-text-secondary hover:text-text-main"
              }
            `}
            aria-label="Notifications"
          >
            <Bell strokeWidth={2} className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9" />
            <UnreadBadge count={unreadCount} />
          </button>

          {activeDropdown === "notifications" && (
            <div className="absolute -right-15 md:right-0 top-12 xl:top-16 2xl:top-20">
              <NotificationDropdown 
                key={notificationDropdownKey}
                isOpen={activeDropdown === "notifications"}
                onNotificationRead={handleNotificationRead}
              />
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
            <Moon strokeWidth={2} className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9" />
          ) : (
            <Sun strokeWidth={2} className="w-5 h-5 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9" />
          )}
        </button>

        {/* Vertical Separator */}
        <div className="w-px mx-1 h-6 xl:h-8 2xl:h-10 bg-border"></div>

        {/* ================= PROFILE AREA ================= */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => toggleDropdown("profile")}
            className={`relative rounded-full overflow-hidden border transition-all duration-200 active:scale-95
              w-8 h-8 md:w-9 md:h-9 xl:w-10 xl:h-10 2xl:w-11 2xl:h-11
              bg-background
              ${
                activeDropdown === "profile"
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
              sizes="(max-width: 768px) 32px, (max-width: 1280px) 40px, 44px"
            />
          </button>

          {activeDropdown === "profile" && (
            <div
              className="absolute right-0 shadow-2xl rounded-[1.5rem] border border-border/50 py-2
                top-12 xl:top-16 2xl:top-20
                w-48 xl:w-64 2xl:w-72
                animate-in fade-in zoom-in-95 duration-200 origin-top-right
                overflow-hidden
                /* Dropdown Styling using globals */
                bg-surface/90 backdrop-blur-xl"
            >
              <div className="flex flex-col text-sm xl:text-lg 2xl:text-xl text-text-secondary">
                {isAdminUser && (
                  <>
                    <Link
                      href="/admin"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-highlight/80 hover:text-text-main"
                      onClick={() => setActiveDropdown(null)}
                    >
                      <BarChart3 className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-primary" />
                      <span className="font-semibold text-primary">Admin Panel</span>
                    </Link>
                    <div className="h-px w-full my-1 bg-border/50"></div>
                  </>
                )}

                <button
                  onClick={() => {
                    if (modal && modal.openUpload) modal.openUpload();
                    else setShowPricingPopup(true);
                    setActiveDropdown(null);
                  }}
                  className="flex items-center gap-3 px-5 py-3 w-full text-left transition-colors hover:bg-surface-highlight/80 hover:text-text-main"
                >
                  <Upload className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Upload</span>
                </button>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-highlight/80 hover:text-text-main"
                >
                  <LayoutDashboard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Dashboard</span>
                </Link>

                {/* Linked Calendar */}
                <Link
                  href="/calendar"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-highlight/80 hover:text-text-main"
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
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-highlight/80 hover:text-text-main cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Pricing</span>
                </div>

                {/* Settings Link */}
                <Link
                  href="/settings/user-details"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-highlight/80 hover:text-text-main"
                  onClick={() => setActiveDropdown(null)}
                >
                  <Settings className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Settings</span>
                </Link>

                <div className="h-px w-full my-1 bg-border/50"></div>

                <button
                  className="flex items-center gap-3 px-5 py-3 w-full text-left transition-colors 
                    text-error hover:bg-error/10 hover:text-error"
                  onClick={async () => {
                    // Clear any client-side state
                    setActiveDropdown(null);

                    // Sign out and redirect to login
                    await signOut({
                      callbackUrl: "/login",
                      redirect: true,
                    });

                    // Force a hard reload to clear any cached state
                    window.location.href = "/login";
                  }}
                >
                  <LogOut className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showPricingPopup && <PricingPopup onClose={() => setShowPricingPopup(false)} />}
    </nav>
  );
};

export default UserNavbar;
