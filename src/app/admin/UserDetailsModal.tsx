"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";
import { UserWithAccounts } from "./AdminDashboard";

// Logo imports
import GoogleLogo from "@/app/assets/logo/Google.webp";
import FacebookLogo from "@/app/assets/logo/Facebook.webp";
import InstagramLogo from "@/app/assets/logo/Instagram.webp";
import TwitterLogo from "@/app/assets/logo/X.webp";
import LinkedInLogo from "@/app/assets/logo/LinkedIn.webp";
import TikTokLogo from "@/app/assets/logo/TikTok.webp";
import YoutubeLogo from "@/app/assets/logo/Youtube.webp";

interface UserDetailsModalProps {
  user: UserWithAccounts;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

// Map platform names to logos
const PROVIDER_LOGOS: Record<string, any> = {
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
  onClose,
  onDelete,
}: UserDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

    modal.addEventListener("keydown", handleTab as any);
    return () => modal.removeEventListener("keydown", handleTab as any);
  }, [isOpen]);

  if (!isOpen) return null;

  const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-modal-title"
      >
        <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-border">
            <h2 id="user-details-modal-title" className="text-xl font-bold text-text-main">
              User Details
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
              aria-label="Close user details modal"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* User Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-main">
                User Information
              </h3>
              
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <p className="text-sm text-text-secondary">Name</p>
                  <p className="text-base font-medium text-text-main">
                    {user.name || "Unnamed User"}
                  </p>
                </div>

                {/* Email */}
                <div>
                  <p className="text-sm text-text-secondary">Email</p>
                  <p className="text-base font-medium text-text-main">
                    {user.email}
                  </p>
                </div>

                {/* Registration Date */}
                <div>
                  <p className="text-sm text-text-secondary">Registration Date</p>
                  <p className="text-base font-medium text-text-main">
                    {registeredDate}
                  </p>
                </div>

                {/* Email Verification Status */}
                <div>
                  <p className="text-sm text-text-secondary mb-2">Email Verification Status</p>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      user.emailVerified
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {user.emailVerified ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Not Verified
                      </>
                    )}
                  </div>
                </div>

                {/* User Role */}
                <div>
                  <p className="text-sm text-text-secondary mb-2">User Role</p>
                  <div
                    className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                      user.role === "ADMIN"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {user.role}
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Connections Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-text-main">
                Connected Social Media Accounts
              </h3>

              {user.socialAccounts.length === 0 ? (
                <p className="text-sm text-text-secondary py-4">
                  No social media accounts connected
                </p>
              ) : (
                <div className="space-y-3">
                  {user.socialAccounts.map((socialAccount, index) => {
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
                          <p className="text-sm font-medium text-text-main">
                            {platform}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {socialAccount.platformUsername || `ID: ${socialAccount.platformAccountId}`}
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
          <div className="p-6 border-t border-border">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-error hover:bg-error/90 text-white rounded-2xl transition-colors font-semibold"
              aria-label="Delete user account"
            >
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              Delete User
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
