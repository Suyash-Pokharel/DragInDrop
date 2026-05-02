"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";

interface DeleteConfirmationModalProps {
  postTitle: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export default function DeleteConfirmationModal({
  postTitle,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
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
    if (isDeleting) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  }, [isDeleting, onClose]);

  // Handle Escape key to close modal (only when not deleting)
  useEffect(() => {
    if (!isOpen || isDeleting) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isDeleting, handleClose]);

  // Focus trap within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the cancel button when modal opens
    cancelButtonRef.current?.focus();

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

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[140] transition-opacity cursor-pointer ${
          isClosing
            ? "opacity-0 duration-200"
            : "animate-[modal-backdrop-in_0.3s_ease-out_forwards]"
        }`}
        onClick={isDeleting ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* Modal - Smaller centered modal */}
      <div
        ref={modalRef}
        className={`fixed inset-0 z-[150] flex items-center justify-center p-4 pointer-events-none transition-all duration-200 ${
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-modal-title"
        aria-describedby="delete-confirmation-modal-description"
      >
        <div
          className={`bg-surface/80 backdrop-blur-xl border border-error/50 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden pointer-events-auto ${!isClosing && "animate-[modal-pop-in_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]"}`}
        >
          {/* Subtle error background glow */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-error/10 blur-3xl rounded-full translate-y-[100%] pointer-events-none" />

          {/* Header with warning styling */}
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-error/20 bg-error/5 rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-error/10 rounded-2xl border border-error/20 text-error shadow-[0_0_15px_-3px_rgba(var(--error),0.3)]">
                <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 id="delete-confirmation-modal-title" className="text-xl font-bold text-text-main">
                Delete Scheduled Post
              </h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="p-2 hover:bg-surface-highlight rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface/50 border border-border"
              aria-label="Close delete confirmation modal"
            >
              <X className="w-5 h-5 text-text-main" />
            </button>
          </div>

          {/* Content */}
          <div
            id="delete-confirmation-modal-description"
            className="p-6 md:p-8 space-y-6 relative z-10"
          >
            {/* Post information */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">
                You are about to permanently delete the following post:
              </p>
              <div className="bg-surface/50 border border-border/60 rounded-2xl p-4">
                <p className="text-base font-bold text-text-main">{postTitle || "Untitled Post"}</p>
              </div>
            </div>

            {/* Warning message */}
            <div className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <p className="text-sm text-error font-medium">
                Video will be permanently deleted. This action cannot be undone.
              </p>
            </div>
          </div>

          {/* Footer - Action buttons */}
          <div className="p-6 pt-0 flex gap-4 relative z-10">
            <button
              ref={cancelButtonRef}
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-surface border border-border hover:bg-surface-highlight hover:border-border/80 text-text-main rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel deletion"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-error hover:bg-[#ff1e1e] text-white rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(var(--error),0.4)] hover:shadow-[0_0_25px_-5px_rgba(var(--error),0.6)] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isDeleting ? "Deleting post" : "Confirm delete post"}
            >
              {isDeleting ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Deleting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Delete Permanently
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
