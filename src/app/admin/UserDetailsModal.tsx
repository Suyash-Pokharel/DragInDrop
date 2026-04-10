"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";
import { UserWithAccounts } from "./AdminDashboard";

// Logo imports
import GoogleLogo from "@/app/assets/logo/Google.webp";
import FacebookLogo from "@/app/assets/logo/Facebook.webp";
import TwitterLogo from "@/app/assets/logo/X.webp";
import LinkedInLogo from "@/app/assets/logo/LinkedIn.webp";
import TikTokLogo from "@/app/assets/logo/TikTok.webp";

interface UserDetailsModalProps {
  user: UserWithAccounts;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

// Map provider names to logos
const PROVIDER_LOGOS: Record<string, any> = {
  google: GoogleLogo,
  facebook: FacebookLogo,
  twitter: TwitterLogo,
  linkedin: LinkedInLogo,
  tiktok: TikTokLogo,
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
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-modal-title"
      >
        <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 id="user-details-modal-title" className="text-xl font-semibold text-text-main">
              User Details
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
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

            {/* OAuth Providers Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-text-main">
                Connected OAuth Providers
              </h3>

              {user.accounts.length === 0 ? (
                <p className="text-sm text-text-secondary py-4">
                  No OAuth providers connected (Manual registration)
                </p>
              ) : (
                <div className="space-y-3">
                  {user.accounts.map((account, index) => {
                    const providerKey = account.provider.toLowerCase();
                    const providerLogo = PROVIDER_LOGOS[providerKey];

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg"
                      >
                        {/* Provider Icon */}
                        {providerLogo && (
                          <div className="w-8 h-8 relative flex-shrink-0">
                            <Image
                              src={providerLogo}
                              alt={`${account.provider} logo`}
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                        
                        {/* Provider Name */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-main capitalize">
                            {account.provider}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Account ID: {account.providerAccountId}
                          </p>
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
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
