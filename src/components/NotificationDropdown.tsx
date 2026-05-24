"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, MessageSquare } from "lucide-react";
import { formatRelativeTimestamp } from "@/lib/formatTimestamp";
import { NotificationType } from "@prisma/client";

interface Notification {
  id: string;
  title: string;
  description: string | null;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

interface NotificationDropdownState {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
}

interface NotificationDropdownProps {
  isOpen?: boolean;
  onNotificationRead?: () => void;
}

// Helper function to get notification icon based on type
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "UPLOAD_SUCCESS":
    case "SOCIAL_ACCOUNT_CONNECTED":
    case "POST_SCHEDULED":
    case "POST_DRAFT_SAVED":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "UPLOAD_FAILED":
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case "SOCIAL_ACCOUNT_DISCONNECTED":
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    default:
      return <MessageSquare className="w-5 h-5 text-blue-500" />;
  }
};

export default function NotificationDropdown({ isOpen = true, onNotificationRead }: NotificationDropdownProps = {}) {
  const [state, setState] = useState<NotificationDropdownState>({
    notifications: [],
    isLoading: false,
    error: null,
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notifications from API
  const fetchNotifications = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/notifications");

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        notifications: data.notifications || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error("[NotificationDropdown] Fetch error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load notifications",
        isLoading: false,
      }));
    }
  };

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      // Update local state to reflect isRead=true
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
      }));

      // Notify parent component to update unread count
      if (onNotificationRead) {
        onNotificationRead();
      }
    } catch (error) {
      console.error("[NotificationDropdown] Mark as read error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to mark notification as read",
      }));
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      // Update all displayed notifications to isRead=true
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
      }));

      // Notify parent component to update unread count
      if (onNotificationRead) {
        onNotificationRead();
      }
    } catch (error) {
      console.error("[NotificationDropdown] Mark all as read error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to mark all notifications as read",
      }));
    }
  };

  // Fetch notifications on component mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Set up polling - only poll when dropdown is open
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Only start polling if dropdown is open
    if (isOpen) {
      // Start polling every 30 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchNotifications();
      }, 30000);
    }

    // Cleanup on unmount or when isOpen changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen]); // Re-run when isOpen changes

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <div
      className="shadow-2xl rounded-[1.5rem] border border-border/50
        w-72 md:w-80 xl:w-96 2xl:w-md
        animate-in fade-in zoom-in-95 duration-200 origin-top-right
        overflow-hidden
        bg-surface/90 backdrop-blur-xl"
    >
      {/* Dropdown header with "Mark all read" button */}
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-surface/50 backdrop-blur-md">
        <h3 className="font-semibold text-text-main text-sm xl:text-base">Notifications</h3>
        {state.notifications.some((n) => !n.isRead) && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-primary hover:text-secondary transition-colors font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {state.isLoading && (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        )}

        {state.error && (
          <div className="p-4 text-center text-red-500">{state.error}</div>
        )}

        {!state.isLoading && !state.error && state.notifications.length === 0 && (
          <div className="p-4 text-center text-gray-500">No notifications</div>
        )}

        {!state.isLoading &&
          !state.error &&
          state.notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`px-5 py-4 flex gap-3 transition-colors cursor-pointer border-b border-border/40 last:border-0
                ${
                  !notification.isRead
                    ? "bg-primary/10 hover:bg-primary/20 backdrop-blur-sm"
                    : "hover:bg-surface-highlight/70"
                }`}
            >
              {/* Notification icon based on type */}
              <div className="flex-shrink-0 mt-1">
                {getNotificationIcon(notification.type)}
              </div>

              {/* Notification content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm xl:text-base text-text-main">{notification.title}</p>
                  {!notification.isRead && (
                    <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                  )}
                </div>
                {notification.description && (
                  <p className="text-xs xl:text-sm text-text-secondary mt-1">
                    {notification.description}
                  </p>
                )}
                <p className="text-[10px] xl:text-xs text-text-secondary/70 mt-1">
                  {formatRelativeTimestamp(new Date(notification.createdAt))}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
