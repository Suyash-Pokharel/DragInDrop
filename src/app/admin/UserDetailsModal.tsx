"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, CheckCircle, XCircle, User } from "lucide-react";
import Image, { StaticImageData } from "next/image";
import { UserWithAccounts } from "./AdminDashboard";

// Logo imports
import FacebookLogo from "@/app/assets/logo/Facebook.webp";
import InstagramLogo from "@/app/assets/logo/Instagram.webp";
import TwitterLogo from "@/app/assets/logo/X.webp";
import LinkedInLogo from "@/app/assets/logo/LinkedIn.webp";
import TikTokLogo from "@/app/assets/logo/TikTok.webp";
import YoutubeLogo from "@/app/assets/logo/Youtube.webp";

interface UserDetailsModalProps {
  user: UserWithAccounts;
  isOpen: boolean;
  isTopModal: boolean;
  onClose: () => void;
  onDelete: () => void;
}

// Map platform names to logos
const PROVIDER_LOGOS: Record<string, StaticImageData> = {
  YouTube: YoutubeLogo,
  Instagram: InstagramLogo,
  TikTok: TikTokLogo,
  Facebook: FacebookLogo,
  Twitter: TwitterLogo,
  LinkedIn: LinkedInLogo,
};

export default function UserDetailsModal({
  user,
  isOpen,
  isTopModal,
  onClose,
  onDelete,
}: UserDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsClosing(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  }, [onClose]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen || !isTopModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isTopModal, handleClose]);

  // Focus trap within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab);
    return () => modal.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[120] transition-opacity cursor-pointer ${
          isClosing
            ? "opacity-0 duration-200"
            : "animate-[modal-backdrop-in_0.3s_ease-out_forwards]"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`fixed inset-0 z-[130] flex items-center justify-center p-4 pointer-events-none transition-all duration-200 ${
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-modal-title"
      >
        <div
          className={`bg-surface/80 backdrop-blur-xl border border-border rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl pointer-events-auto ${!isClosing && "animate-[modal-pop-in_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-border/60 bg-surface/40 backdrop-blur-md rounded-t-[2rem]">
            <h2
              id="user-details-modal-title"
              className="text-xl font-bold flex items-center gap-2 text-text-main"
            >
              <User className="w-6 h-6 text-primary" />
              User Profile
            </h2>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="p-2.5 hover:bg-surface-highlight rounded-xl transition-colors bg-surface border border-border shadow-sm active:scale-95"
              aria-label="Close user details modal"
            >
              <X className="w-5 h-5 text-text-main" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* User Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-main">User Information</h3>

              <div className="space-y-3">
                {/* Name & Avatar */}
                <div className="flex items-center gap-4 bg-surface/30 p-4 rounded-2xl border border-border/50">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 flex items-center justify-center text-primary text-xl font-black shadow-sm shrink-0 uppercase">
                    {user.name ? user.name.charAt(0) : "U"}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                      {user.name || "Unnamed User"}
                    </p>
                    <p className="text-sm text-text-secondary">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Registration Date */}
                  <div className="bg-surface/30 p-4 rounded-2xl border border-border/50">
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                      Registration Date
                    </p>
                    <p className="text-sm font-bold text-text-main">{registeredDate}</p>
                  </div>

                  {/* User Role */}
                  <div className="bg-surface/30 p-4 rounded-2xl border border-border/50">
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                      User Role
                    </p>
                    <div
                      className={`inline-flex px-3 py-1 mt-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors ${
                        user.role === "ADMIN"
                          ? "bg-secondary/10 text-secondary border border-secondary/20"
                          : "bg-surface-highlight text-text-secondary border border-border"
                      }`}
                    >
                      {user.role}
                    </div>
                  </div>
                </div>

                {/* Email Verification Status */}
                <div className="bg-surface/30 p-4 rounded-2xl border border-border/50 col-span-2">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                    Email Verification
                  </p>
                  <div
                    className={`inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm transition-colors ${
                      user.emailVerified
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-error/10 text-error border border-error/20"
                    }`}
                  >
                    {user.emailVerified ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Not Verified
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Connections Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-text-main">
                Connected Social Media Accounts
              </h3>

              {user.SocialAccount.length === 0 ? (
                <p className="text-sm text-text-secondary py-4">
                  No social media accounts connected
                </p>
              ) : (
                <div className="space-y-3">
                  {user.SocialAccount.map((socialAccount, index) => {
                    const platform = socialAccount.platform;
                    const providerLogo = PROVIDER_LOGOS[platform];

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-background border border-border rounded-2xl"
                      >
                        {/* Provider Icon */}
                        {providerLogo && (
                          <div className="w-8 h-8 relative flex-shrink-0">
                            <Image
                              src={providerLogo}
                              alt={`${platform} logo`}
                              fill
                              sizes="24px"
                              className="object-contain"
                            />
                          </div>
                        )}

                        {/* Provider Name and Details */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-main">{platform}</p>
                          <p className="text-xs text-text-secondary">
                            {socialAccount.platformUsername ||
                              `ID: ${socialAccount.platformAccountId}`}
                          </p>
                        </div>

                        {/* Active Status Badge */}
                        <div className="flex-shrink-0">
                          {socialAccount.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer - Delete Button */}
          <div className="p-6 border-t border-border/60 bg-surface/40 backdrop-blur-md">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border border-error text-error bg-error/5 hover:bg-error hover:text-white rounded-2xl transition-all duration-300 font-bold active:scale-95 group"
              aria-label="Delete user account"
            >
              <AlertTriangle
                className="w-5 h-5 group-hover:rotate-12 transition-transform"
                aria-hidden="true"
              />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
