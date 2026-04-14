"use client";

import { useMemo, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { UserWithAccounts } from "./AdminDashboard";

interface AllUsersModalProps {
  users: UserWithAccounts[];
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserWithAccounts) => void;
}

export default function AllUsersModal({
  users,
  isOpen,
  onClose,
  onSelectUser,
}: AllUsersModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Sort users by registration date (newest first)
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [users]
  );

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
        aria-labelledby="all-users-modal-title"
      >
        <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-[2rem] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-border">
            <h2 id="all-users-modal-title" className="text-xl font-bold text-text-main">
              All Users ({users.length})
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
              aria-label="Close all users modal"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {sortedUsers.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                No users registered yet
              </p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                          Email
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                          Registered Date
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                          OAuth Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers.map((user) => {
                        const oauthCount = user.socialAccounts.length;
                        const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <tr
                            key={user.id}
                            onClick={() => onSelectUser(user)}
                            className="border-b border-border/60 last:border-b-0 hover:bg-surface-highlight/60 cursor-pointer transition-colors rounded-xl"
                          >
                            <td className="py-3 px-4">
                              <p className="text-sm font-medium text-text-main">
                                {user.name || "Unnamed User"}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm text-text-secondary">
                                {user.email}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm text-text-secondary">
                                {registeredDate}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <div
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                  oauthCount > 0
                                    ? "bg-primary/10 text-primary"
                                    : "bg-surface border border-border text-text-secondary"
                                }`}
                              >
                                {oauthCount} {oauthCount === 1 ? "provider" : "providers"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {sortedUsers.map((user) => {
                    const oauthCount = user.socialAccounts.length;
                    const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <div
                        key={user.id}
                        onClick={() => onSelectUser(user)}
                        className="bg-background border border-border rounded-2xl p-4 hover:bg-surface-highlight cursor-pointer transition-all hover:border-primary/30 hover:-translate-y-0.5"
                      >
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium text-text-main">
                              {user.name || "Unnamed User"}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {user.email}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <p className="text-xs text-text-secondary">
                              {registeredDate}
                            </p>
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                oauthCount > 0
                                  ? "bg-primary/10 text-primary"
                                  : "bg-surface border border-border text-text-secondary"
                              }`}
                            >
                              {oauthCount} {oauthCount === 1 ? "provider" : "providers"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
