"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Link2, LayoutGrid, Unlink, AlertCircle, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

import { APP_PLATFORMS, type AppPlatform } from "@/lib/platforms";
import { useUser } from "@/app/components/UserProvider";

function SocialAccountsContent() {
  const { connectedPlatforms, connectedPlatformIds, refreshConnectedPlatforms, platformsLoading } = useUser();
  const [platformToDisconnect, setPlatformToDisconnect] = useState<AppPlatform | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const error = searchParams.get("error");
  const connected = searchParams.get("connected");

  // Clear query params after 5 seconds
  useEffect(() => {
    if (error || connected) {
      const timeout = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete("error");
        newParams.delete("connected");
        router.replace(`/settings/social-accounts?${newParams.toString()}`);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, connected, searchParams, router]);

  const handleConnect = (platform: AppPlatform) => {
    if (!platform.oauthEnabled) return;
    // Redirect to the server-side OAuth initiation route
    window.location.href = `/api/social-accounts/connect/${platform.id}`;
  };

  const handleForgetClick = (platform: AppPlatform) => {
    setPlatformToDisconnect(platform);
  };

  const confirmDisconnect = async () => {
    if (!platformToDisconnect) return;
    
    setIsDisconnecting(true);
    try {
      const res = await fetch(`/api/social-accounts/disconnect/${platformToDisconnect.id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        await refreshConnectedPlatforms();
        setPlatformToDisconnect(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to disconnect account");
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      alert("An error occurred while disconnecting the account.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const cancelDisconnect = () => {
    if (isDisconnecting) return;
    setPlatformToDisconnect(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Social Accounts</h2>
        <p className="text-text-secondary text-sm md:text-base">Connect your social media platforms to seamlessly schedule and upload videos.</p>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl flex items-center gap-3 animate-in zoom-in-95 duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Failed to connect: {error.replace(/_/g, " ")}</p>
        </div>
      )}
      {connected && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-xl flex items-center gap-3 animate-in zoom-in-95 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Successfully connected {connected}!</p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-text-main">Available Platforms</h3>
            <p className="text-xs text-text-secondary">All the available platforms to connect and schedule posts.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {APP_PLATFORMS.map((platform) => {
            const connectedInfo = connectedPlatforms.find(p => p.platform === platform.id);
            const isConnected = !!connectedInfo;
            
            return (
              <div key={platform.id} className="bg-background border border-border p-4 rounded-xl flex items-center justify-between transition-all hover:border-primary/50 group">
                <div className="flex items-center gap-4">
                  <div className="relative w-8 h-8 md:w-10 md:h-10">
                    <Image src={platform.icon} alt={platform.name} fill className="object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-main text-sm">{platform.name}</h4>
                    <p className="text-[10px] md:text-xs text-text-secondary truncate max-w-[120px]">
                      {isConnected ? (connectedInfo.platformUsername || "Connected") : platform.oauthEnabled ? "Not connected" : "Coming Soon"}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => isConnected ? handleForgetClick(platform) : handleConnect(platform)}
                  disabled={!platform.oauthEnabled && !isConnected}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    isConnected 
                      ? "bg-surface border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500" 
                      : platform.oauthEnabled 
                        ? "bg-surface border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white hover:border-green-500"
                        : "bg-surface border-border text-text-secondary cursor-not-allowed opacity-50"
                  }`}
                >
                  {isConnected ? (
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

      {/* Secondary Box */}
      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="text-lg font-medium text-text-main">Missing a Platform?</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-sm">
            We are constantly adding new integrations. Let us know which social network you want to see next!
          </p>
        </div>
        <button className="px-5 py-2.5 border border-border hover:bg-surface-highlight hover:border-text-secondary text-text-main text-sm font-medium rounded-xl transition-colors shrink-0 whitespace-nowrap">
          Request Integration
        </button>
      </div>

      {/* Disconnect Confirmation Modal */}
      {platformToDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" onClick={cancelDisconnect}>
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-main mb-2">Remove Connection?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Do you really want to remove the connection with <span className="font-semibold">{platformToDisconnect.name}</span>?
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={cancelDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-highlight transition-colors text-text-main disabled:opacity-50"
              >
                Stay Connected
              </button>
              <button 
                onClick={confirmDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SocialAccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SocialAccountsContent />
    </Suspense>
  );
}
