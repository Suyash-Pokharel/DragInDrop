"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface UserData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePic: string | null;
}

type UserContextType = {
  // User data
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profilePic: string | null;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Update methods
  setUserData: (data: Partial<UserData>) => void;
  refreshUserData: () => Promise<void>;
  clearUserData: () => void;
  
  // Backward compatibility
  connectedPlatforms: string[];
  togglePlatformConnection: (name: string) => void;
  setProfilePic: (url: string | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserDataState] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const fetchUserData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/user/me');
      if (!response.ok) {
        if (response.status === 401) {
          // Session expired, redirect to login
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      setUserDataState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const updateUserData = (data: Partial<UserData>) => {
    setUserDataState(prev => prev ? { ...prev, ...data } : null);
  };

  const clearUserData = () => {
    setUserDataState(null);
  };

  const togglePlatformConnection = (name: string) => {
    setConnectedPlatforms(prev => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  // Backward compatibility method
  const setProfilePic = (url: string | null) => {
    updateUserData({ profilePic: url });
  };

  return (
    <UserContext.Provider value={{
      userId: userData?.userId ?? null,
      firstName: userData?.firstName ?? null,
      lastName: userData?.lastName ?? null,
      email: userData?.email ?? null,
      profilePic: userData?.profilePic ?? null,
      isLoading,
      error,
      setUserData: updateUserData,
      refreshUserData: fetchUserData,
      clearUserData,
      connectedPlatforms,
      togglePlatformConnection,
      setProfilePic,
    }}>
      {children}
    </UserContext.Provider>
  );
};
