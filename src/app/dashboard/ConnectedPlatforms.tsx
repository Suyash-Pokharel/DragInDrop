import Link from "next/link";
import Image from "next/image";
import { Link2, ArrowRight } from "lucide-react";

import YoutubeLogo from "../assets/logo/Youtube.webp";
import InstagramLogo from "../assets/logo/Instagram.webp";
import TikTokLogo from "../assets/logo/TikTok.webp";
import FacebookLogo from "../assets/logo/Facebook.webp";
import XLogo from "../assets/logo/X.webp";
import ThreadsLogo from "../assets/logo/Threads.webp";

interface SocialAccount {
  id: string;
  platform: string;
  isActive: boolean;
}

interface ConnectedPlatformsProps {
  socialAccounts: SocialAccount[];
}

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

export default function ConnectedPlatforms({ socialAccounts }: ConnectedPlatformsProps) {
  return (
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
  );
}
