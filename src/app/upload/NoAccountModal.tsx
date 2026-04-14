"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

interface NoAccountModalProps {
  onClose: () => void;
}

export default function NoAccountModal({ onClose }: NoAccountModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    requestAnimationFrame(() => setShowModal(true));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  const doClose = () => {
    setShowModal(false);
    setTimeout(() => onClose(), 250);
  };

  const handleConnect = () => {
    setShowModal(false);
    setTimeout(() => {
      onClose();
      router.push("/settings/social-accounts");
    }, 250);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        showModal ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) doClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-surface/85 backdrop-blur-2xl w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border border-border/60 transition-all duration-300 ease-out transform p-8 ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={doClose}
          className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-surface/60 backdrop-blur-md border border-border/60 shadow-sm text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center justify-center text-center mt-4">
          <div className="w-12 h-12 bg-warning/10 text-warning rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-text-main mb-2">No Accounts Connected</h2>
          <p className="text-sm text-text-secondary mb-6">
            You don&apos;t have any social media accounts connected. Connect at least one platform
            to start uploading videos.
          </p>

          <div className="flex w-full gap-3 mt-2">
            <button
              onClick={doClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight transition-colors text-text-main shadow-sm active:scale-95"
            >
              Later
            </button>
            <button
              onClick={handleConnect}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-sm font-bold transition-colors shadow-md hover:shadow-lg active:scale-95"
            >
              Connect Now
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
