"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type ConnectedPlatform = {
  /** Canonical lowercase id: "youtube", "tiktok" */
  platform: string;
  /** The user's display name / handle on that platform */
  platformUsername: string;
  /** The user's unique ID on that platform */
  platformUserId: string;
};

type UserContextType = {
  /** Full connected platform objects from the database */
  connectedPlatforms: ConnectedPlatform[];
  /** Derived string array of platform ids for backward compat (e.g. connectedPlatformIds.includes("youtube")) */
  connectedPlatformIds: string[];
  /** Re-fetch connected platforms from the server (call after connect/disconnect) */
  refreshConnectedPlatforms: () => Promise<void>;
  /** True while the initial fetch is in flight */
  platformsLoading: boolean;

  profilePic: string | null;
  setProfilePic: (url: string | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);

  const fetchConnectedPlatforms = useCallback(async () => {
    try {
      const res = await fetch("/api/social-accounts/list", {
        credentials: "same-origin",
        // cache: no-store ensures we always get fresh data after connect/disconnect
        cache: "no-store",
      });
      if (res.ok) {
        const data: ConnectedPlatform[] = await res.json();
        setConnectedPlatforms(data);
      } else if (res.status === 401) {
        // Not logged in — empty list is correct
        setConnectedPlatforms([]);
      }
    } catch {
      // Network error or not on a page that has a session — silently keep empty
      setConnectedPlatforms([]);
    } finally {
      setPlatformsLoading(false);
    }
  }, []);

  // Fetch on initial mount
  useEffect(() => {
    fetchConnectedPlatforms();
  }, [fetchConnectedPlatforms]);

  // Derived: list of platform ids as strings (e.g. ["youtube", "tiktok"])
  const connectedPlatformIds = connectedPlatforms.map((p) => p.platform);

  return (
    <UserContext.Provider
      value={{
        connectedPlatforms,
        connectedPlatformIds,
        refreshConnectedPlatforms: fetchConnectedPlatforms,
        platformsLoading,
        profilePic,
        setProfilePic,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
