"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MailCheck } from "lucide-react";
import { Reveal } from "../components/Reveal";

interface ResetSentProps {
  email: string;
  onClose: () => void;
}

export default function ResetSent({ email, onClose }: ResetSentProps) {
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

  if (!mounted) return null;

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

        {/* Success Message */}
        <div className="p-6 md:p-8 text-center animate-in fade-in duration-300">
          <Reveal width="100%" delay={0.1}>
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 text-success">
              <MailCheck size={32} strokeWidth={2.5} />
            </div>
          </Reveal>

          <Reveal width="100%" delay={0.2}>
            <h2 className="text-3xl font-bold text-text-main mb-3 tracking-tight">
              Check your email
            </h2>
            <p className="text-text-secondary text-base mb-4 leading-relaxed">
              We sent a recovery link to <br />
              <strong className="text-text-main font-semibold">{email}</strong>
            </p>
          </Reveal>

          <Reveal width="100%" delay={0.3}>
            <div className="space-y-6">
              <p className="text-sm text-text-secondary/80 mb-6 bg-background py-3 px-4 rounded-lg border border-border">
                Please click the link in the sent email to recover your account and reset the
                password.
              </p>

              <button
                onClick={handleClose}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20"
              >
                Close
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>,
    document.body,
  );
}
