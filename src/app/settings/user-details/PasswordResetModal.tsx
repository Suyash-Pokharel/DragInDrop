"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Loader2 } from "lucide-react";
import { Reveal } from "../../components/Reveal";
import ResetSent from "../../login/ResetSent";

interface PasswordResetModalProps {
  userEmail: string;
  onClose: () => void;
}

export default function PasswordResetModal({ userEmail, onClose }: PasswordResetModalProps) {
  const [showResetSent, setShowResetSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Animation & Mount State
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 1. Handle Mounting (Solves Hydration Mismatch)
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // 2. Handle Animation & Scroll Lock
  useEffect(() => {
    if (!mounted) return;

    requestAnimationFrame(() => setShowModal(true));
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  const handleClose = () => {
    setShowModal(false);
    setTimeout(onClose, 300);
  };

  const handleSendResetEmail = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const result = await res.json();

      if (result.success) {
        setShowResetSent(true);
      } else {
        alert(result.error || "Failed to send password reset email. Please try again.");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  // If ResetSent modal is shown, render it instead
  if (showResetSent) {
    return <ResetSent email={userEmail} onClose={onClose} />;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        showModal ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Modal Container */}
      <div
        className={`w-full max-w-md bg-surface rounded-2xl shadow-2xl relative border border-border transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full text-text-secondary hover:bg-surface-highlight hover:text-text-main transition-colors"
        >
          <X size={20} />
        </button>

        {/* --- CONFIRMATION VIEW --- */}
        <div className="p-6 md:p-8">
          <Reveal width="100%" delay={0.05}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Mail size={32} />
              </div>
              <h2 className="text-3xl font-bold text-text-main mb-2">Update Password?</h2>
              <p className="text-text-secondary text-sm">
                We&apos;ll send a password reset link to your email address.
              </p>
            </div>
          </Reveal>

          <Reveal width="100%" delay={0.1}>
            <div className="space-y-6">
              <div className="bg-surface-highlight/50 border border-border rounded-xl p-4">
                <p className="text-sm text-text-secondary mb-2">Email address:</p>
                <p className="text-base font-semibold text-text-main">{userEmail}</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-lg border border-border text-text-main font-semibold hover:bg-surface-highlight active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendResetEmail}
                  disabled={isLoading}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>,
    document.body,
  );
}
