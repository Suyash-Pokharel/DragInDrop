"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useModal } from "@/app/components/ModalProvider";
import { useUser } from "@/app/components/UserProvider";
import { APP_PLATFORMS } from "@/lib/platforms";

interface SelectPlatformProps {
  onClose: () => void;
}

export default function SelectPlatform({ onClose }: SelectPlatformProps) {
  const router = useRouter();
  const {
    clearUpload,
    goBackToEditPost,
    postTitle,
    postDescription,
    postScheduledFor,
    fileKey,
    videoFileName,
    videoFileSize,
  } = useModal();
  const { connectedPlatforms } = useUser();

  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Draft save states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showDraftSuccess, setShowDraftSuccess] = useState(false);

  // Only show platforms that the user has verified/connected in settings
  const availablePlatforms = APP_PLATFORMS.filter((p) => connectedPlatforms.includes(p.name));

  useEffect(() => {
    setSelectedPlatforms(connectedPlatforms);
  }, [connectedPlatforms]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    requestAnimationFrame(() => setShowModal(true));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  const handleCloseRequest = () => {
    setShowDiscardConfirm(true);
  };

  const doClose = () => {
    setShowModal(false);
    setTimeout(() => {
      clearUpload();
      onClose();
    }, 250);
  };

  const handleSchedule = async () => {
    // Pre-flight validation
    if (!fileKey || !videoFileName || !videoFileSize) {
      console.error("Missing file data:", { fileKey, videoFileName, videoFileSize });
      setSubmitError("Video upload incomplete. Please upload a video first.");
      return;
    }

    // Set isSubmitting to true during request
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Include session token in request headers (handled by Next.js automatically)
      // Send raw datetime-local string to API - server will convert to UTC using user's timezone
      const scheduledForISO = postScheduledFor;

      console.log("Submitting post with data:", {
        title: postTitle,
        description: postDescription,
        scheduledFor: scheduledForISO,
        videoFileKey: fileKey,
        videoFileName,
        videoFileSize,
        selectedPlatforms,
      });

      // Make POST request to /api/posts endpoint
      // Gather all required data from context/props
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: postTitle,
          description: postDescription,
          scheduledFor: scheduledForISO,
          videoFileKey: fileKey,
          videoFileName,
          videoFileSize,
          selectedPlatforms,
        }),
      });

      // Handle 401 errors with redirect to login
      if (response.status === 401) {
        router.push("/login");
        return;
      }

      // Display validation errors from API response
      // Display server errors with generic message
      if (!response.ok) {
        const error = await response.json();

        // Display specific validation message from API response
        if (response.status === 400) {
          setSubmitError(error.error || "Validation error occurred");
        } else if (response.status >= 500) {
          // Server error - display generic message
          setSubmitError("An error occurred while saving your post. Please try again.");
        } else {
          setSubmitError(error.error || "Failed to create post");
        }
        return;
      }

      await response.json();

      // Refresh dashboard data to show the new scheduled post immediately
      try {
        const dashboardResponse = await fetch("/api/dashboard");
        if (!dashboardResponse.ok) {
          console.error("Failed to refresh dashboard");
        }
        // Trigger dashboard refresh if on dashboard page
        if (typeof window !== "undefined") {
          const win = window as Window & { refreshDashboard?: () => void };
          if (win.refreshDashboard) {
            win.refreshDashboard();
          }
        }
        router.refresh(); // Trigger Next.js to refetch server components
      } catch (refreshError) {
        console.error("Error refreshing dashboard:", refreshError);
      }

      // Show success message
      setSuccessMessage("Video has been scheduled successfully");

      // 3.5 - Close modals and clear state after showing success
      setTimeout(() => {
        setShowModal(false);
        setTimeout(() => {
          clearUpload();
          onClose();
        }, 250);
      }, 2000); // Show success message for 2 seconds before closing
    } catch (error) {
      // Display network errors with retry option
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setSubmitError("Network error. Please check your connection and try again.");
      } else {
        // Display error message
        setSubmitError(error instanceof Error ? error.message : "An error occurred");
      }
    } finally {
      // Set isSubmitting to false after request completes
      setIsSubmitting(false);
    }
  };

  const togglePlatform = (name: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  const handleSaveDraft = async () => {
    // Pre-flight validation
    if (!postTitle.trim()) {
      setDraftError("Title is required");
      return;
    }

    if (!fileKey || !videoFileName || !videoFileSize) {
      setDraftError("Video upload incomplete. Please upload a video first.");
      return;
    }

    setIsSavingDraft(true);
    setDraftError(null);

    try {
      const response = await fetch("/api/posts/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postTitle,
          description: postDescription || undefined,
          videoFileKey: fileKey,
          videoFileName,
          videoFileSize,
        }),
      });

      if (response.status === 401) {
        // Authentication error - redirect to login
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save draft");
      }

      // Success
      // Refresh dashboard data to show the new draft immediately
      try {
        const dashboardResponse = await fetch("/api/dashboard");
        if (!dashboardResponse.ok) {
          console.error("Failed to refresh dashboard");
        }
        // Trigger dashboard refresh if on dashboard page
        if (typeof window !== "undefined") {
          const win = window as Window & { refreshDashboard?: () => void };
          if (win.refreshDashboard) {
            win.refreshDashboard();
          }
        }
        router.refresh(); // Trigger Next.js to refetch server components
      } catch (refreshError) {
        console.error("Error refreshing dashboard:", refreshError);
      }

      setShowDraftSuccess(true);
      setTimeout(() => {
        clearUpload();
        onClose();
      }, 2000);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setDraftError("Network error. Please check your connection and try again.");
      } else {
        setDraftError(
          error instanceof Error
            ? error.message
            : "An error occurred while saving your draft. Please try again.",
        );
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        showModal ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCloseRequest();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-surface/85 backdrop-blur-2xl w-full max-w-2xl max-h-[86dvh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border border-border/60 transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={handleCloseRequest}
          className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-surface/60 backdrop-blur-md border border-border/60 shadow-sm text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto py-6 custom-scrollbar px-6 md:px-12 flex-1 flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-2 mt-4">
            Select Platforms
          </h2>
          <p className="text-center text-sm text-text-secondary mb-10 max-w-sm">
            Choose where you want to publish your video.
          </p>

          <div className="flex flex-wrap justify-center gap-4 md:gap-5 w-full max-w-lg mb-4 mx-auto">
            {availablePlatforms.length === 0 ? (
              <div className="w-full text-center text-sm py-12 text-text-secondary bg-surface/40 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm">
                No connected platforms found.
              </div>
            ) : (
              availablePlatforms.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.name);
                return (
                  <div
                    key={platform.name}
                    onClick={() => togglePlatform(platform.name)}
                    className={`flex flex-col items-center justify-center gap-4 p-5 rounded-2xl border-[2px] cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.85rem)] aspect-[6/5] sm:aspect-square ${
                      isSelected
                        ? "border-[#10b981] bg-background shadow-md bg-gradient-to-t from-[#10b981]/10 to-transparent"
                        : "border-border/60 bg-surface/40 backdrop-blur-md hover:border-border/80 shadow-sm"
                    }`}
                  >
                    <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden flex shrink-0 items-center justify-center drop-shadow-sm">
                      <Image
                        src={platform.icon}
                        alt={platform.name}
                        fill
                        sizes="40px"
                        className="object-contain"
                      />
                    </div>
                    <span
                      className={`text-sm md:text-base font-semibold ${isSelected ? "text-[#10b981]" : "text-text-secondary"}`}
                    >
                      {platform.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 p-5 border-t border-border/60 bg-surface/40 backdrop-blur-md mt-auto">
          {/* Display success message */}
          {successMessage && (
            <div className="text-sm text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 rounded-md px-3 py-2">
              {successMessage}
            </div>
          )}

          {/* 5.5 - Display error message with retry option */}
          {submitError && (
            <div className="flex items-start justify-between gap-2 text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
              <span className="flex-1">{submitError}</span>
              <button
                onClick={handleSchedule}
                disabled={isSubmitting}
                className="text-xs font-medium underline hover:no-underline disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setTimeout(() => goBackToEditPost(), 250);
                }}
                disabled={isSubmitting || isSavingDraft}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 text-text-main hover:bg-surface-highlight transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Back
              </button>

              <button
                onClick={handleSaveDraft}
                disabled={!postTitle.trim() || isSavingDraft || isSubmitting}
                className={`py-2.5 text-sm font-semibold transition-all ${
                  !postTitle.trim() || isSavingDraft || isSubmitting
                    ? "text-text-secondary/40 cursor-not-allowed"
                    : "text-text-secondary hover:text-text-main cursor-pointer active:scale-95"
                }`}
              >
                {isSavingDraft ? "Saving..." : "Save as Draft"}
              </button>
            </div>

            <button
              onClick={handleSchedule}
              disabled={selectedPlatforms.length === 0 || isSubmitting || isSavingDraft}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 active:scale-95 ${
                selectedPlatforms.length === 0 || isSubmitting || isSavingDraft
                  ? "bg-primary/60 cursor-not-allowed"
                  : "bg-primary hover:bg-secondary shadow-md hover:shadow-lg"
              }`}
            >
              {/* 3.9 - Disable button and show loading spinner when submitting */}
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                "Schedule Post"
              )}
            </button>
          </div>
        </div>

        {/* Discard Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-2 text-text-main">Discard Post?</h3>
              <p className="text-sm text-text-secondary mb-6">
                If you leave now, you&apos;ll lose your scheduled details and video.
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Continue editing
                </button>
                <button
                  onClick={doClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-error text-white shadow-md hover:shadow-lg active:scale-95 w-full sm:w-auto"
                >
                  Discard post
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Draft Success Message */}
        {showDraftSuccess && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">Draft Saved!</h3>
              <p className="text-sm text-text-secondary text-center">
                Your post has been saved as a draft. You can continue editing it later from your
                dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Draft Error Message */}
        {draftError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-error" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">
                Failed to Save Draft
              </h3>
              <p className="text-sm text-text-secondary text-center mb-6">{draftError}</p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setDraftError(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white shadow-md hover:shadow-lg active:scale-95 w-full sm:w-auto"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
