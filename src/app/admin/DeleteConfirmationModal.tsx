"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";
import { UserWithAccounts } from "./AdminDashboard";

interface DeleteConfirmationModalProps {
  user: UserWithAccounts;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export default function DeleteConfirmationModal({
  user,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle Escape key to close modal (only when not deleting)
  useEffect(() => {
    if (!isOpen || isDeleting) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isDeleting, onClose]);

  // Focus trap within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={isDeleting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal - Smaller centered modal */}
      <div 
        ref={modalRef}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-modal-title"
        aria-describedby="delete-confirmation-modal-description"
      >
        <div className="bg-surface/80 backdrop-blur-xl border border-error/40 rounded-[2rem] w-full max-w-md shadow-2xl">
          {/* Header with warning styling */}
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-error/20 bg-error/5 rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error/10 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-error" aria-hidden="true" />
              </div>
              <h2 id="delete-confirmation-modal-title" className="text-lg font-bold text-text-main">
                Confirm Deletion
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              disabled={isDeleting}
              className="p-2 hover:bg-surface-highlight rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close delete confirmation modal"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div id="delete-confirmation-modal-description" className="p-6 space-y-4">
            {/* User information */}
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                You are about to delete the following user:
              </p>
              <div className="bg-background border border-border rounded-2xl p-4 space-y-1">
                <p className="text-base font-medium text-text-main">
                  {user.name || "Unnamed User"}
                </p>
                <p className="text-sm text-text-secondary">{user.email}</p>
              </div>
            </div>

            {/* Warning message */}
            <div className="bg-error/10 border border-error/20 rounded-2xl p-4">
              <p className="text-sm text-error font-medium">
                This action is permanent and cannot be undone
              </p>
            </div>
          </div>

          {/* Footer - Action buttons */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-surface border border-border hover:bg-surface-highlight text-text-main rounded-2xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel deletion"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-error hover:bg-error/90 text-white rounded-2xl transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isDeleting ? "Deleting user" : "Confirm delete user"}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
