"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import { UserWithAccounts } from "./AdminDashboard";

interface AllUsersModalProps {
  users: UserWithAccounts[];
  isOpen: boolean;
  isTopModal: boolean;
  onClose: () => void;
  onSelectUser: (user: UserWithAccounts) => void;
}

export default function AllUsersModal({
  users,
  isOpen,
  isTopModal,
  onClose,
  onSelectUser,
}: AllUsersModalProps) {
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

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [users]
  );

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

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    closeButtonRef.current?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
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
      <div
        className={`fixed inset-0 bg-black/60 z-[100] ${
          isClosing ? "opacity-0 duration-200" : "animate-[modal-backdrop-in_0.3s_ease-out_forwards]"
        } transition-opacity cursor-pointer`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div 
        ref={modalRef}
        className={`fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none transition-all duration-200 ${
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-users-modal-title"
      >
        <div className={`bg-surface/80 backdrop-blur-xl border border-border rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl pointer-events-auto ${!isClosing && 'animate-[modal-pop-in_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]'}`}>
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-border/60 bg-surface/40 backdrop-blur-md rounded-t-[2rem]">
            <div>
              <h2 id="all-users-modal-title" className="text-2xl font-bold flex items-center gap-2 text-text-main">
                <Users className="text-primary w-7 h-7" />
                List of All Users
              </h2>
              <p className="text-sm text-text-secondary mt-1">Total registered users: <span className="font-bold text-text-main">{users.length}</span></p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="p-2.5 hover:bg-surface-highlight rounded-xl transition-colors bg-surface border border-border shadow-sm active:scale-95"
              aria-label="Close all users modal"
            >
              <X className="w-5 h-5 text-text-main" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 sm:p-6 custom-scrollbar">
            {sortedUsers.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                No users registered yet
              </p>
            ) : (
              <>
                <div className="hidden md:block bg-surface/20 rounded-2xl border border-border/50 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface/50 border-b border-border/50 backdrop-blur-sm">
                      <tr className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        <th className="py-4 px-6">User Profile</th>
                        <th className="py-4 px-6">Email Address</th>
                        <th className="py-4 px-6">Registration Date</th>
                        <th className="py-4 px-6 text-right">Integrations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {sortedUsers.map((user) => {
                        const oauthCount = user.SocialAccount.length;
                        const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <tr
                            key={user.id}
                            onClick={() => onSelectUser(user)}
                            className="group hover:bg-surface-highlight/40 cursor-pointer transition-colors"
                          >
                            <td className="py-4 px-6 w-[35%]">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm shrink-0 uppercase group-hover:scale-105 transition-transform">
                                  {user.name ? user.name.charAt(0) : "U"}
                                </div>
                                <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors truncate">
                                  {user.name || "Unnamed User"}
                                </p>
                              </div>
                            </td>
                            <td className="py-4 px-6 w-[25%]">
                              <p className="text-sm text-text-secondary truncate">
                                {user.email}
                              </p>
                            </td>
                            <td className="py-4 px-6 w-[20%]">
                              <p className="text-sm text-text-secondary font-medium whitespace-nowrap">
                                {registeredDate}
                              </p>
                            </td>
                            <td className="py-4 px-6 text-right w-[20%]">
                              <div
                                className={`inline-flex px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors ${
                                  oauthCount > 0
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "bg-surface text-text-secondary border border-border"
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

                <div className="md:hidden space-y-3">
                  {sortedUsers.map((user) => {
                    const oauthCount = user.SocialAccount.length;
                    const registeredDate = new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <div
                        key={user.id}
                        onClick={() => onSelectUser(user)}
                        className="group p-4 bg-surface/30 backdrop-blur-md border border-border/60 rounded-xl transition-all duration-300 hover:bg-background hover:border-secondary/40 hover:shadow-glow hover:-translate-y-0.5 relative overflow-hidden cursor-pointer"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm shrink-0 uppercase">
                            {user.name ? user.name.charAt(0) : "U"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-main truncate group-hover:text-primary transition-colors">
                              {user.name || "Unnamed User"}
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <p className="text-xs text-text-secondary font-medium">
                            {registeredDate}
                          </p>
                          <div
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors ${
                              oauthCount > 0
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-surface-highlight text-text-secondary border border-border"
                            }`}
                          >
                            {oauthCount} {oauthCount === 1 ? "provider" : "providers"}
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
    </>,
    document.body
  );
}
