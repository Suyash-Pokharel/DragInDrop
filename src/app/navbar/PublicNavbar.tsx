"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { signIn } from "next-auth/react";
// TODO: Wire up Google OAuth flow — this logo is used in the Google sign-in button below.
import GoogleLogo from "../assets/logo/Google.webp";

export default function PublicNavbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme icon
  useEffect(() => {
    // Wrap in timeout to avoid synchronous state update warning
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Helper to check active link
  const isActive = (path: string) => pathname === path;

  return (
    <nav
      className="w-full flex items-center justify-between transition-colors duration-300 ease-in-out sticky top-0 z-50
        h-16 xl:h-20 2xl:h-24 px-4 md:px-8 2xl:px-12 bg-surface/85 backdrop-blur-xl border-b border-border/60 text-text-main select-none shadow-sm"
    >
      {/* --- LEFT: LOGO --- */}
      <Link href="/" className="cursor-pointer">
        <div
          className="font-bold tracking-relaxed whitespace-nowrap text-primary
            text-xl md:text-2xl xl:text-3xl 2xl:text-4xl hover:text-secondary transition-colors"
        >
          DragInDrop
        </div>
      </Link>

      {/* --- RIGHT: LINKS & ACTIONS --- */}
      <div className="flex items-center gap-4 md:gap-8">
        {/* Navigation Links (Hidden on small mobile if needed, or keep valid) */}
        <div className="hidden md:flex items-center gap-6 xl:gap-8 text-sm xl:text-lg font-medium">
          <Link
            href="/"
            className={`transition-colors hover:text-primary ${
              isActive("/") ? "text-primary font-bold" : "text-text-secondary"
            }`}
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className={`transition-colors hover:text-primary ${
              isActive("/pricing") ? "text-primary font-bold" : "text-text-secondary"
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/contactus"
            className={`transition-colors hover:text-primary ${
              isActive("/contactus") ? "text-primary font-bold" : "text-text-secondary"
            }`}
          >
            Contact Us
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Google Button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-background/50 backdrop-blur-md border border-border/60 text-text-main text-sm font-bold hover:bg-surface-highlight hover:border-primary/40 transition-all active:scale-95 shadow-sm"
          >
            <Image
              src={GoogleLogo}
              alt="Google"
              width={18}
              height={18}
              priority
              className="object-contain"
            />
            <span>Google</span>
          </button>

          {/* Sign In Button */}
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-secondary transition-all active:scale-95 shadow-md hover:shadow-lg"
          >
            Sign In
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-full text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-all active:scale-90"
            aria-label="Toggle Theme"
          >
            {mounted && theme === "dark" ? (
              <Moon size={22} strokeWidth={2} />
            ) : (
              <Sun size={22} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
