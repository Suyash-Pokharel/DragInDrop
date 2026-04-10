"use client";

import { useMemo } from "react";
import Image from "next/image";
import { UserWithAccounts } from "./AdminDashboard";

// Logo imports
import GoogleLogo from "@/app/assets/logo/Google.webp";
import FacebookLogo from "@/app/assets/logo/Facebook.webp";
import TwitterLogo from "@/app/assets/logo/X.webp";
import LinkedInLogo from "@/app/assets/logo/LinkedIn.webp";
import TikTokLogo from "@/app/assets/logo/TikTok.webp";

interface OAuthProviderStatsProps {
  users: UserWithAccounts[];
}

interface ProviderConfig {
  name: string;
  logo: any;
  key: string;
}

const PROVIDERS: ProviderConfig[] = [
  { name: "Google", logo: GoogleLogo, key: "google" },
  { name: "Facebook", logo: FacebookLogo, key: "facebook" },
  { name: "Twitter", logo: TwitterLogo, key: "twitter" },
  { name: "LinkedIn", logo: LinkedInLogo, key: "linkedin" },
  { name: "TikTok", logo: TikTokLogo, key: "tiktok" },
];

export default function OAuthProviderStats({ users }: OAuthProviderStatsProps) {
  // Calculate provider counts from users.accounts array
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {
      google: 0,
      facebook: 0,
      twitter: 0,
      linkedin: 0,
      tiktok: 0,
    };

    users.forEach((user) => {
      user.accounts.forEach((account) => {
        const provider = account.provider.toLowerCase();
        if (provider in counts) {
          counts[provider]++;
        }
      });
    });

    return counts;
  }, [users]);

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-text-main mb-4">
        OAuth Provider Statistics
      </h3>
      
      {/* Horizontal scrollable cards on mobile, grid layout on desktop */}
      <div className="flex gap-4 overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-x-visible pb-2">
        {PROVIDERS.map((provider) => (
          <div
            key={provider.key}
            className="flex-shrink-0 w-40 md:w-auto bg-surface border border-border rounded-lg p-4 hover:bg-surface-highlight transition-colors"
          >
            <div className="flex flex-col items-center gap-3">
              {/* Provider Icon */}
              <div className="w-12 h-12 relative">
                <Image
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
              
              {/* Provider Name */}
              <p className="text-sm font-medium text-text-main text-center">
                {provider.name}
              </p>
              
              {/* User Count */}
              <p className="text-2xl font-bold text-text-main">
                {providerCounts[provider.key]}
              </p>
              
              <p className="text-xs text-text-secondary">
                {providerCounts[provider.key] === 1 ? "user" : "users"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
