"use client";

import React, { createContext, useContext, useState } from "react";

type UserContextType = {
  tempImage: string | null;
  setTempImage: (url: string | null) => void;
  connectedPlatforms: string[];
  togglePlatformConnection: (name: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};

/** Manages temporary UI state only (uploaded images, platform connections). Does not fetch or store database data. */
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const togglePlatformConnection = (name: string) => {
    setConnectedPlatforms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  return (
    <UserContext.Provider
      value={{ tempImage, setTempImage, connectedPlatforms, togglePlatformConnection }}
    >
      {children}
    </UserContext.Provider>
  );
};
