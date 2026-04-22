"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Toast, { ToastVariant } from "./Toast";

interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, variant: ToastVariant) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = variant === "success" ? 3000 : 5000;

    const newToast: ToastData = {
      id,
      message,
      variant,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, "success");
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <Toast
                  id={toast.id}
                  message={toast.message}
                  variant={toast.variant}
                  duration={toast.duration}
                  onDismiss={dismissToast}
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
