"use client";

import React, { createContext, useContext, useState } from "react";

type UserContextType = {
  profilePic: string | null;
  setProfilePic: (url: string | null) => void;
  connectedPlatforms: string[];
  togglePlatformConnection: (name: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const togglePlatformConnection = (name: string) => {
    setConnectedPlatforms((prev) => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  return (
    <UserContext.Provider value={{ profilePic, setProfilePic, connectedPlatforms, togglePlatformConnection }}>
      {children}
    </UserContext.Provider>
  );
};
