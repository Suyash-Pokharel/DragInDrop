"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, QrCode, ShieldCheck } from "lucide-react";

interface TwoFactorModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function TwoFactorModal({ onClose, onSuccess }: TwoFactorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");

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
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only numeric characters, max 6 digits
    if (/^\d{0,6}$/.test(val)) {
      setCode(val);
    }
  };

  const handleVerify = () => {
    if (code.length === 6) {
      // Simulate verification
      setShowModal(false);
      setTimeout(() => {
        onSuccess();
      }, 250);
    }
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
        className={`bg-surface/80 backdrop-blur-xl w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border border-border/50 transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={doClose}
          className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-surface border border-border/60 shadow-sm text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 md:p-8 flex flex-col items-center">
          {step === 1 ? (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text-main mb-2">Setup Authenticator</h2>
              <p className="text-sm text-text-secondary mb-6">
                Scan the QR code with your authenticator app (like Google Authenticator or Authy) to
                link your account.
              </p>

              <div className="bg-white p-4 rounded-xl shadow-inner border border-border mb-8">
                <QrCode className="w-48 h-48 text-black" strokeWidth={1} />
              </div>

              <div className="w-full flex gap-3">
                <button
                  onClick={doClose}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold border border-border/60 text-text-main hover:bg-surface-highlight transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-primary text-white hover:bg-secondary transition-colors shadow-sm"
                >
                  Enter Code
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold text-text-main mb-2">Verify Authenticator</h2>
              <p className="text-sm text-text-secondary mb-8">
                Enter the 6-digit code from your authenticator application to verify the setup.
              </p>

              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                className="w-full text-center tracking-[1em] font-mono text-3xl font-bold bg-surface border-2 border-border focus:border-primary rounded-xl px-4 py-6 text-text-main focus:outline-none transition-colors placeholder:text-text-secondary/30 mb-8"
              />

              <div className="w-full flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold border border-border/60 text-text-main hover:bg-surface-highlight transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleVerify}
                  disabled={code.length !== 6}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-colors shadow-sm ${
                    code.length === 6
                      ? "bg-primary text-white hover:bg-secondary"
                      : "bg-primary/50 text-white/70 cursor-not-allowed"
                  }`}
                >
                  Verify
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
