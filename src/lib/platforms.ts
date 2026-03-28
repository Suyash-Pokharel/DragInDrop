import facebookLogo from "../app/assets/logo/Facebook.webp";
import instagramLogo from "../app/assets/logo/Instagram.webp";
import linkedinLogo from "../app/assets/logo/LinkedIn.webp";
import threadsLogo from "../app/assets/logo/Threads.webp";
import tiktokLogo from "../app/assets/logo/TikTok.webp";
import xLogo from "../app/assets/logo/X.webp";
import youtubeLogo from "../app/assets/logo/Youtube.webp";
import type { StaticImageData } from "next/image";

export type AppPlatform = {
  /** Canonical lowercase identifier — used in API route paths */
  id: string;
  /** Display name shown in the UI */
  name: string;
  /** Platform logo */
  icon: StaticImageData;
  /**
   * true  → OAuth credentials are available; Connect button is active.
   * false → Credentials pending approval; shown as "Coming Soon".
   */
  oauthEnabled: boolean;
};

export const APP_PLATFORMS: AppPlatform[] = [
  { id: "youtube",   name: "YouTube",   icon: youtubeLogo,   oauthEnabled: true  },
  { id: "tiktok",    name: "TikTok",    icon: tiktokLogo,    oauthEnabled: true  },
  { id: "facebook",  name: "Facebook",  icon: facebookLogo,  oauthEnabled: false },
  { id: "instagram", name: "Instagram", icon: instagramLogo, oauthEnabled: false },
  { id: "x",         name: "X",         icon: xLogo,         oauthEnabled: false },
  { id: "threads",   name: "Threads",   icon: threadsLogo,   oauthEnabled: false },
  { id: "linkedin",  name: "LinkedIn",  icon: linkedinLogo,  oauthEnabled: false },
];
