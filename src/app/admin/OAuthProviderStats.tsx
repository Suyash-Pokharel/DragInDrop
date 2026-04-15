"use client";

import { useMemo } from "react";
import Image, { StaticImageData } from "next/image";
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
  logo: StaticImageData;
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

// Helper function to get platform-specific glow class
const getPlatformGlowClass = (platform: string): string => {
  const glowClasses: Record<string, string> = {
    'YouTube': 'hover:shadow-[0_0_30px_-5px_#FF0000]',
    'Instagram': 'hover:shadow-[0_0_30px_-5px_#E1306C]',
    'TikTok': 'hover:shadow-[0_0_30px_-5px_#00F2EA]',
    'Facebook': 'hover:shadow-[0_0_30px_-5px_#1877F2]',
    'Twitter': 'hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]',
    'LinkedIn': 'hover:shadow-[0_0_30px_-5px_#0A66C2]',
    'Google': 'hover:shadow-[0_0_30px_-5px_#4285F4]',
  };
  return glowClasses[platform] || 'hover:shadow-[0_0_30px_-5px_var(--primary)]';
};

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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {PROVIDERS.slice(0, 8).map((provider) => (
        <div
          key={provider.key}
          className={`bg-surface/60 backdrop-blur-md border border-border rounded-3xl p-6 hover:-translate-y-1 transition-all duration-300 ${getPlatformGlowClass(provider.name)}`}
        >
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="w-12 h-12 relative">
              <Image
                src={provider.logo}
                alt={`${provider.name} logo`}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            
            {/* Right: Count */}
            <div className="text-right">
              <p className="text-3xl md:text-4xl font-black text-text-main">
                {providerCounts[provider.key]}
              </p>
              <p className="text-xs text-text-secondary font-medium">
                {providerCounts[provider.key] === 1 ? "user" : "users"}
              </p>
            </div>
          </div>
          
          {/* Platform Name */}
          <p className="text-sm font-semibold text-text-secondary mt-4">
            {provider.name}
          </p>
        </div>
      ))}
    </div>
  );
}
