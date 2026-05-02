"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type UserContextType = {
  tempImage: string | null;
  setTempImage: (url: string | null) => void;
  connectedPlatforms: string[];
  refetchConnectedPlatforms: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};

/** Manages user state including connected platforms fetched from database. */
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [mockConnectedPlatforms, setMockConnectedPlatforms] = useState<string[]>([]);

  // Load mock connected platforms from session storage
  useEffect(() => {
    const loadMockConnections = () => {
      if (typeof window !== "undefined") {
        const savedMockConnections = sessionStorage.getItem("mockConnectedPlatforms");
        if (savedMockConnections) {
          try {
            const parsed = JSON.parse(savedMockConnections);
            if (Array.isArray(parsed)) {
              setMockConnectedPlatforms(parsed);
            }
          } catch (error) {
            console.error("Failed to parse mock connections from session storage:", error);
          }
        }
      }
    };

    loadMockConnections();

    // Listen for storage changes to sync across tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mockConnectedPlatforms") {
        loadMockConnections();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Combine real and mock connected platforms
  const allConnectedPlatforms = [...connectedPlatforms, ...mockConnectedPlatforms];

  // Fetch connected platforms from database
  const refetchConnectedPlatforms = useCallback(async () => {
    try {
      const response = await fetch("/api/user/connected-platforms");
      if (response.ok) {
        const data = await response.json();
        setConnectedPlatforms(data.connectedPlatforms || []);
      } else if (response.status === 401) {
        // User is not authenticated - this is expected, don't log error
        setConnectedPlatforms([]);
      } else {
        console.error("Failed to fetch connected platforms:", response.statusText);
        setConnectedPlatforms([]);
      }
    } catch (error) {
      // Only log error if it's not a network/auth issue
      if (error instanceof Error && !error.message.includes("fetch")) {
        console.error("Error fetching connected platforms:", error);
      }
      setConnectedPlatforms([]);
    }
  }, []);

  // Fetch connected platforms on mount
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const res = await fetch("/api/user/connected-platforms");
        if (res.ok) {
          const data = await res.json();
          setConnectedPlatforms(data.connectedPlatforms || []);
        }
      } catch (error) {
        if (error instanceof Error && !error.message.includes("fetch")) {
          console.error("Error fetching connected platforms:", error);
        }
        setConnectedPlatforms([]);
      }
    };
    fetchPlatforms();
  }, []);

  return (
    <UserContext.Provider
      value={{
        tempImage,
        setTempImage,
        connectedPlatforms: allConnectedPlatforms,
        refetchConnectedPlatforms,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
