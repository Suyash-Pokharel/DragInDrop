"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Image from "next/image";
import { useModal } from "@/app/components/ModalProvider";
import { useUser } from "@/app/components/UserProvider";
import { APP_PLATFORMS } from "@/lib/platforms";

interface SelectPlatformProps {
  onClose: () => void;
}

export default function SelectPlatform({ onClose }: SelectPlatformProps) {
  const { clearUpload, setScheduled, fileKey, uploaded, scheduled } = useModal();
  const { connectedPlatforms } = useUser();
  
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  
  // Only show platforms that the user has verified/connected in settings
  const availablePlatforms = APP_PLATFORMS.filter(p => connectedPlatforms.includes(p.name));

  useEffect(() => {
    setSelectedPlatforms(connectedPlatforms);
  }, [connectedPlatforms]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    requestAnimationFrame(() => setShowModal(true));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, [mounted]);

  const handleCloseRequest = () => {
    setShowDiscardConfirm(true);
  };

  const deleteVideo = async (key: string) => {
    try {
      const response = await fetch("/api/upload/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileKey: key }),
      });

      if (!response.ok) {
        console.error("Failed to delete video:", await response.text());
      }
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const doClose = async () => {
    // Cleanup video if it was uploaded but not scheduled
    if (fileKey && uploaded && !scheduled) {
      await deleteVideo(fileKey);
    }
    
    setShowModal(false);
    setTimeout(() => {
      clearUpload();
      onClose();
    }, 250);
  };

  const handleSchedule = () => {
    // Mark as scheduled so video is not deleted
    setScheduled(true);
    alert("Post Scheduled for: " + selectedPlatforms.join(", "));
    setShowModal(false);
    setTimeout(() => {
      clearUpload();
      onClose();
    }, 250);
  };

  const togglePlatform = (name: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        showModal ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCloseRequest();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-background w-full max-w-2xl max-h-[86dvh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border border-border transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={handleCloseRequest}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-surface text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto py-6 custom-scrollbar px-6 md:px-12 flex-1 flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-2 mt-4">
            Select Platforms
          </h2>
          <p className="text-center text-sm text-text-secondary mb-10 max-w-sm">
            Choose where you want to publish your video.
          </p>

          <div className="flex flex-wrap justify-center gap-4 md:gap-5 w-full max-w-lg mb-4 mx-auto">
            {availablePlatforms.length === 0 ? (
              <div className="w-full text-center text-sm py-12 text-text-secondary bg-surface rounded-xl border border-border">
                No connected platforms found.
              </div>
            ) : (
              availablePlatforms.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.name);
                return (
                  <div 
                    key={platform.name}
                    onClick={() => togglePlatform(platform.name)}
                    className={`flex flex-col items-center justify-center gap-4 p-5 rounded-2xl border-[2px] cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.85rem)] aspect-[6/5] sm:aspect-square ${
                      isSelected 
                        ? "border-[#10b981] bg-background shadow-sm" 
                        : "border-border/60 bg-surface hover:border-border"
                    }`}
                  >
                    <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden flex shrink-0 items-center justify-center drop-shadow-sm">
                      <Image src={platform.icon} alt={platform.name} fill className="object-contain" />
                    </div>
                    <span className={`text-sm md:text-base font-semibold ${isSelected ? "text-[#10b981]" : "text-text-secondary"}`}>
                      {platform.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 border-t border-border bg-surface mt-auto">
          <button
            onClick={() => setShowDiscardConfirm(true)}
            className="px-4 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-highlight transition-colors"
          >
            Cancel Post
          </button>
          
          <button
            onClick={handleSchedule}
            disabled={selectedPlatforms.length === 0}
            className={`px-6 py-2 rounded-md text-sm font-medium text-white transition-colors ${
              selectedPlatforms.length === 0
                ? "bg-primary/60 cursor-not-allowed"
                : "bg-primary hover:bg-secondary shadow-md"
            }`}
          >
            Schedule Post
          </button>
        </div>

        {/* Discard Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Discard Post?</h3>
              <p className="text-sm text-text-secondary mb-4">
                If you leave now, you’ll lose your scheduled details and video.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2 rounded-md text-sm border border-border hover:bg-surface-highlight transition-colors"
                >
                  Continue editing
                </button>
                <button
                  onClick={doClose}
                  className="px-4 py-2 rounded-md text-sm bg-error text-white hover:opacity-95 transition-opacity"
                >
                  Discard post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
