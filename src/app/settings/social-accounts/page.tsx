"use client";

import React, { useState } from "react";
import { Link2, LayoutGrid, Unlink } from "lucide-react";
import Image from "next/image";

import { APP_PLATFORMS } from "@/lib/platforms";
import { useUser } from "@/app/components/UserProvider";

export default function SocialAccountsPage() {
  const { connectedPlatforms, togglePlatformConnection } = useUser();
  const [platformToDisconnect, setPlatformToDisconnect] = useState<string | null>(null);

  const handleConnect = (name: string) => {
    togglePlatformConnection(name);
  };

  const handleForgetClick = (name: string) => {
    setPlatformToDisconnect(name);
  };

  const confirmDisconnect = () => {
    if (platformToDisconnect) {
      if (connectedPlatforms.includes(platformToDisconnect)) {
        togglePlatformConnection(platformToDisconnect);
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
        <p className="text-text-secondary text-sm md:text-base">Connect your social media platforms to seamlessly schedule and upload videos.</p>
      </div>

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
            const isConnected = connectedPlatforms.includes(platform.name);
            return (
              <div key={platform.name} className="bg-background border border-border p-4 rounded-xl flex items-center justify-between transition-all hover:border-primary/50 group">
                <div className="flex items-center gap-4">
                  <div className="relative w-8 h-8 md:w-10 md:h-10">
                    <Image src={platform.icon} alt={platform.name} fill className="object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-main text-sm">{platform.name}</h4>
                    <p className="text-xs text-text-secondary">{isConnected ? "Connected" : "Not connected"}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => isConnected ? handleForgetClick(platform.name) : handleConnect(platform.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    isConnected 
                      ? "bg-surface border-red-500 text-red-500 hover:bg-red-500 hover:text-white" 
                      : "bg-surface border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
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

      {/* Secondary Box to balance page height and fill vertical space */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-main mb-2">Remove Connection?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Do you really want to remove the connection with <span className="font-semibold">{platformToDisconnect}</span>?
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
