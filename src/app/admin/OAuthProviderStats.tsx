"use client";

import { useMemo } from "react";
import Image from "next/image";
import { UserWithAccounts } from "./AdminDashboard";

// Logo imports
import GoogleLogo from "@/app/assets/logo/Google.webp";
import FacebookLogo from "@/app/assets/logo/Facebook.webp";
import InstagramLogo from "@/app/assets/logo/Instagram.webp";
import TwitterLogo from "@/app/assets/logo/X.webp";
import LinkedInLogo from "@/app/assets/logo/LinkedIn.webp";
import TikTokLogo from "@/app/assets/logo/TikTok.webp";
import YoutubeLogo from "@/app/assets/logo/Youtube.webp";

interface OAuthProviderStatsProps {
  users: UserWithAccounts[];
}

interface ProviderConfig {
  name: string;
  logo: any;
  key: string;
  type: "login" | "social";
}

const PROVIDERS: ProviderConfig[] = [
  // OAuth Login Providers
  { name: "Google", logo: GoogleLogo, key: "google", type: "login" },
  // Social Media Platforms  
  { name: "YouTube", logo: YoutubeLogo, key: "YouTube", type: "social" },
  { name: "Instagram", logo: InstagramLogo, key: "Instagram", type: "social" },
  { name: "TikTok", logo: TikTokLogo, key: "TikTok", type: "social" },
  { name: "Facebook", logo: FacebookLogo, key: "Facebook", type: "social" },
  { name: "Twitter", logo: TwitterLogo, key: "Twitter", type: "social" },
  { name: "LinkedIn", logo: LinkedInLogo, key: "LinkedIn", type: "social" },
];

export default function OAuthProviderStats({ users }: OAuthProviderStatsProps) {
  // Calculate provider counts from both login accounts and social accounts
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {
      // Login providers
      google: 0,
      // Social media platforms
      YouTube: 0,
      Instagram: 0,
      TikTok: 0,
      Facebook: 0,
      Twitter: 0,
      LinkedIn: 0,
    };

    users.forEach((user) => {
      // Count OAuth login providers (accounts table)
      user.accounts.forEach((account) => {
        const provider = account.provider.toLowerCase();
        if (provider in counts) {
          counts[provider]++;
        }
      });

      // Count social media connections (socialAccounts table)
      user.socialAccounts.forEach((socialAccount) => {
        const platform = socialAccount.platform;
        if (platform in counts && socialAccount.isActive) {
          counts[platform]++;
        }
      });
    });

    return counts;
  }, [users]);

  return (
    <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-7 md:overflow-x-visible pb-2">
      {PROVIDERS.map((provider) => (
        <div
          key={provider.key}
          className="flex-shrink-0 w-40 md:w-auto bg-surface border border-border rounded-lg p-3 hover:bg-surface-highlight transition-colors"
        >
          <div className="flex flex-col items-center gap-2">
            {/* Provider Icon */}
            <div className="w-10 h-10 relative">
              <Image
                src={provider.logo}
                alt={`${provider.name} logo`}
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
            
            {/* Provider Name */}
            <p className="text-xs font-medium text-text-main text-center">
              {provider.name}
            </p>
            
            {/* User Count */}
            <p className="text-xl font-bold text-text-main">
              {providerCounts[provider.key]}
            </p>
            
            <p className="text-[10px] text-text-secondary">
              {providerCounts[provider.key] === 1 ? "user" : "users"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
