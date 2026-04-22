"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

export type ToastVariant = "success" | "error";

export interface ToastProps {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  onDismiss: (id: string) => void;
}

export default function Toast({ id, message, variant, duration, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(id);
    }, 300);
  }, [id, onDismiss]);

  useEffect(() => {
    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, duration);

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    return () => {
      clearTimeout(dismissTimer);
      clearInterval(progressInterval);
    };
  }, [duration, handleDismiss]);

  const variantStyles = {
    success: {
      container: "bg-success/10 border-success/30 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]",
      icon: "text-success",
      iconBg: "bg-success/10 border-success/20",
      progress: "bg-success",
    },
    error: {
      container: "bg-error/10 border-error/30 shadow-[0_0_20px_-5px_rgba(var(--error),0.3)]",
      icon: "text-error",
      iconBg: "bg-error/10 border-error/20",
      progress: "bg-error",
    },
  };

  const styles = variantStyles[variant];
  const Icon = variant === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        relative overflow-hidden
        bg-surface/95 backdrop-blur-xl border rounded-2xl
        shadow-2xl
        min-w-[320px] max-w-md
        transition-all duration-300 ease-out
        ${styles.container}
        ${
          isExiting
            ? "opacity-0 translate-x-full scale-95"
            : "opacity-100 translate-x-0 scale-100 animate-[toast-slide-in_0.3s_cubic-bezier(0.16,1,0.3,1)]"
        }
      `}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-border/20">
        <div
          className={`h-full transition-all duration-50 linear ${styles.progress}`}
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-start gap-3 p-4 pt-5">
        <div className={`p-2 rounded-xl border ${styles.iconBg} shrink-0`}>
          <Icon className={`w-5 h-5 ${styles.icon}`} aria-hidden="true" />
        </div>

        <p className="flex-1 text-sm font-medium text-text-main pt-1.5">{message}</p>

        <button
          onClick={handleDismiss}
          className="p-1.5 hover:bg-surface-highlight rounded-lg transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
