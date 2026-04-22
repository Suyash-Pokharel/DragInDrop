"use client";

import { useState, useEffect } from "react";
import { Link2, LayoutGrid, Unlink } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import { APP_PLATFORMS } from "@/lib/platforms";

interface SocialAccountsProps {
  initialConnectedPlatforms: string[];
}

export default function SocialAccounts({ initialConnectedPlatforms }: SocialAccountsProps) {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(initialConnectedPlatforms);
  
  const [mockConnectedPlatforms, setMockConnectedPlatforms] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedMockConnections = sessionStorage.getItem('mockConnectedPlatforms');
      if (savedMockConnections) {
        try {
          const parsed = JSON.parse(savedMockConnections);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error('Failed to parse mock connections from session storage:', error);
        }
      }
    }
    return [];
  });
  
  const [platformToDisconnect, setPlatformToDisconnect] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const searchParams = useSearchParams();

  const refetchConnectedPlatforms = async () => {
    try {
      const response = await fetch("/api/user/connected-platforms");
      if (response.ok) {
        const data = await response.json();
        setConnectedPlatforms(data.connectedPlatforms || []);
      } else {
        console.error("Failed to fetch connected platforms:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching connected platforms:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mockConnectedPlatforms', JSON.stringify(mockConnectedPlatforms));
    }
  }, [mockConnectedPlatforms]);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setTimeout(() => {
        setToastMessage({ type: "success", message: "Account Connected Successfully!" });
        refetchConnectedPlatforms();
      }, 0);
      window.history.replaceState({}, "", "/settings/social-accounts");
    } else if (error) {
      setTimeout(() => {
        setToastMessage({ type: "error", message: error });
      }, 0);
      window.history.replaceState({}, "", "/settings/social-accounts");
    }
  }, [searchParams]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleConnect = async (name: string) => {
    if (name === "TikTok") {
      setConnectingPlatform(name);
      setTimeout(() => {
        window.location.href = "/api/oauth/tiktok/authorize";
      }, 0);
    } else if (name === "YouTube") {
      setConnectingPlatform(name);
      setTimeout(() => {
        window.location.href = "/api/oauth/youtube/authorize";
      }, 0);
    } else {
      setMockConnectedPlatforms(prev => {
        if (!prev.includes(name)) {
          return [...prev, name];
        }
        return prev;
      });
      setToastMessage({ type: "success", message: `${name} Connected Successfully!` });
    }
  };

  const handleForgetClick = (name: string) => {
    setPlatformToDisconnect(name);
  };

  const confirmDisconnect = async () => {
    if (platformToDisconnect) {
      if (platformToDisconnect === "TikTok" || platformToDisconnect === "YouTube") {
        try {
          const endpoint = platformToDisconnect === "TikTok" 
            ? "/api/oauth/tiktok/disconnect"
            : "/api/oauth/youtube/disconnect";
          
          const response = await fetch(endpoint, {
            method: "DELETE",
          });

          if (response.ok) {
            setToastMessage({ type: "error", message: "Account disconnected successfully!" });
            await refetchConnectedPlatforms();
          } else {
            const data = await response.json();
            setToastMessage({ type: "error", message: data.error || "Failed to disconnect account" });
          }
        } catch {
          setToastMessage({ type: "error", message: "Failed to disconnect account" });
        }
      } else {
        setMockConnectedPlatforms(prev => prev.filter(platform => platform !== platformToDisconnect));
        setToastMessage({ type: "error", message: `${platformToDisconnect} disconnected successfully!` });
      }
      setPlatformToDisconnect(null);
    }
  };

  const cancelDisconnect = () => {
    setPlatformToDisconnect(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Social Accounts</h2>
        <p className="text-text-secondary text-sm md:text-base">
          Connect your social media platforms to seamlessly schedule and upload videos.
        </p>
      </div>

      <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-text-main">Available Platforms</h3>
            <p className="text-xs text-text-secondary">
              All the available platforms to connect and schedule posts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {APP_PLATFORMS.map((platform) => {
            const isConnected = connectedPlatforms.includes(platform.name) || mockConnectedPlatforms.includes(platform.name);
            return (
              <div
                key={platform.name}
                className="bg-surface/40 backdrop-blur-md border border-border/60 p-5 rounded-2xl flex items-center justify-between transition-all hover:border-primary/50 group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-8 h-8 md:w-10 md:h-10">
                    <Image
                      src={platform.icon}
                      alt={platform.name}
                      fill
                      sizes="(max-width: 768px) 32px, 40px"
                      className="object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-main text-sm">{platform.name}</h4>
                    <p className="text-xs text-text-secondary">
                      {isConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    isConnected ? handleForgetClick(platform.name) : handleConnect(platform.name)
                  }
                  disabled={connectingPlatform === platform.name}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 border ${
                    isConnected
                      ? "bg-surface border-red-500 text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      : "bg-surface border-green-500 text-green-500 hover:bg-green-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {connectingPlatform === platform.name ? (
                    <>
                      <span>Connecting...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <Unlink className="w-4 h-4" />
                      <span>Forget</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h3 className="text-lg font-medium text-text-main">Missing a Platform?</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-sm">
            We are constantly adding new integrations. Let us know which social network you want to
            see next!
          </p>
        </div>
        <button className="px-6 py-2.5 border border-border/60 hover:bg-surface-highlight hover:border-text-secondary text-text-main text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 shrink-0 whitespace-nowrap">
          Request Integration
        </button>
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border ${
              toastMessage.type === "success"
                ? "bg-green-500 border-green-600 text-white"
                : "bg-red-500 border-red-600 text-white"
            }`}
          >
            <p className="text-sm font-medium">{toastMessage.message}</p>
          </div>
        </div>
      )}

      {platformToDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-main mb-2">Remove Connection?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Do you really want to remove the connection with{" "}
              <span className="font-semibold">{platformToDisconnect}</span>?
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={cancelDisconnect}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-highlight transition-colors text-text-main"
              >
                Stay Connected
              </button>
              <button
                onClick={confirmDisconnect}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
