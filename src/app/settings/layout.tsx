"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Share2,
  Sliders,
  Bell,
  CreditCard,
  Gift
} from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "User Details", href: "/settings/user-details", icon: User },
    { name: "Social Accounts", href: "/settings/social-accounts", icon: Share2 },
    { name: "Preferences", href: "/settings/preferences", icon: Sliders },
    { name: "Notifications", href: "/settings/notifications", icon: Bell },
    { name: "Subscription", href: "/settings/subscription", icon: CreditCard },
    { name: "Referral", href: "/settings/referral", icon: Gift },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-text-main flex flex-col md:flex-row max-w-7xl mx-auto w-full pt-8 md:pt-10 px-4 md:px-8 2xl:px-12 gap-8 pb-12 transition-colors duration-300">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 xl:w-72 flex-shrink-0">
        <div className="sticky top-8 md:top-10 flex flex-col gap-1 md:gap-2">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-4 md:mb-6 px-3">
            Settings
          </h1>
          
          <nav className="flex flex-col gap-1 p-2 md:p-3 bg-surface border border-border rounded-xl md:rounded-2xl shadow-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm md:text-base ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-text-secondary hover:bg-surface-highlight hover:text-text-main font-medium"
                  }`}
                >
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? "text-primary" : "text-text-secondary"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
      
    </div>
  );
}
