"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, ChevronLeft, Loader2, Globe2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useModal } from "@/app/components/ModalProvider";
import { useUser } from "@/app/components/UserProvider";
import { useToast } from "@/app/components/ToastProvider";
import { APP_PLATFORMS } from "@/lib/platforms";

interface EditPostProps {
  onClose: () => void;
  postId?: string; // Optional postId for edit mode
}

export default function EditPost({ onClose, postId }: EditPostProps) {
  const { 
    progress, 
    previewUrl, 
    uploaded, 
    clearUpload, 
    selectedDate, 
    openSelectPlatform,
    postTitle,
    setPostTitle,
    postDescription,
    setPostDescription,
    postScheduledFor,
    setPostScheduledFor,
    uploadError,
    clearError,
    handleUpload,
    goBackToUpload,
    fileKey,
    videoFileName,
    videoFileSize,
  } = useModal();
  const { connectedPlatforms } = useUser();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Mode detection
  const isEditMode = !!postId;

  // Edit mode states
  const [loadPostError, setLoadPostError] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Draft save operation states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showDraftSuccess, setShowDraftSuccess] = useState(false);

  // User preferences for timezone display
  const [userTimezone, setUserTimezone] = useState<string | null>(null);

  // Track original scheduled date for validation (Bug 3 fix)
  const [originalScheduledFor, setOriginalScheduledFor] = useState<string>("");

  // Fetch post data for edit mode
  const fetchPostData = useCallback(async () => {
    if (!postId) return;
    
    setLoadPostError(null);
    
    try {
      const response = await fetch(`/api/posts/${postId}`);
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      if (response.status === 403) {
        setLoadPostError("You do not have permission to edit this post");
        return;
      }
      
      if (response.status === 404) {
        setLoadPostError("Post not found");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        setLoadPostError(errorData.error || "Failed to load post data");
        return;
      }
      
      const postData = await response.json();
      
      // Pre-populate form fields
      setPostTitle(postData.title);
      setPostDescription(postData.description || "");
      setSelectedPlatforms(postData.selectedPlatforms || []);
      
      // Convert scheduledFor from UTC to user timezone for display
      if (postData.scheduledFor && userTimezone) {
        const utcDate = new Date(postData.scheduledFor);
        const localDateStr = utcDate.toLocaleString('sv-SE', { 
          timeZone: userTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(' ', 'T');
        setPostScheduledFor(localDateStr);
        setOriginalScheduledFor(localDateStr); // Track original date for validation
      } else if (postData.scheduledFor) {
        // Fallback to UTC if no timezone set
        const utcDate = new Date(postData.scheduledFor);
        const formattedDate = formatDateTimeLocal(utcDate);
        setPostScheduledFor(formattedDate);
        setOriginalScheduledFor(formattedDate); // Track original date for validation
      }
      
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setLoadPostError("Network error. Please check your connection and try again.");
      } else {
        setLoadPostError("An error occurred while loading the post. Please try again.");
      }
    }
  }, [postId, userTimezone, setPostTitle, setPostDescription, setPostScheduledFor]);

  /**
   * Get UTC offset for a timezone
   * Returns format like "UTC+5:45" or "UTC-8:00"
   */
  const getUTCOffset = (timezone: string): string => {
    try {
      const now = new Date();
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return 'UTC';
    }
  };

  // Fetch user timezone on component mount
  useEffect(() => {
    const fetchUserTimezone = async () => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const preferences = await response.json();
          // Simply use the timezone if it exists (should be auto-saved from Upload page)
          setUserTimezone(preferences.timezone || null);
        }
      } catch (error) {
        console.error('Failed to fetch user timezone:', error);
      }
    };

    fetchUserTimezone();
  }, []);

  // Fetch post data when in edit mode and timezone is loaded
  useEffect(() => {
    if (isEditMode && userTimezone !== null) {
      fetchPostData();
    }
  }, [isEditMode, userTimezone, fetchPostData]);

  // Helper to format Date for datetime-local (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Initialize scheduleDate from selectedDate if available
  useEffect(() => {
    if (selectedDate && !postScheduledFor) {
      setPostScheduledFor(formatDateTimeLocal(selectedDate));
    }
  }, [selectedDate, postScheduledFor, setPostScheduledFor]);

  // Validation states
  const [titleTouched, setTitleTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);

  const isTitleValid = postTitle.trim() !== "" && postTitle.length <= 100;
  const isDateFilled = postScheduledFor.trim() !== "";
  
  // Title validation error
  const getTitleError = (): string | null => {
    if (!titleTouched) return null;
    if (postTitle.trim() === "") return "Title is required";
    if (postTitle.length > 100) return "Title must not exceed 100 characters";
    return null;
  };
  
  const titleError = getTitleError();
  
  // Description validation
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  
  const getDescriptionError = (): string | null => {
    if (!descriptionTouched) return null;
    if (postDescription.length > 250) return "Description must not exceed 250 characters";
    return null;
  };
  
  const descriptionError = getDescriptionError();

  // Must be at least 10 minutes in the future
  const getDateError = (): string | null => {
    if (!isDateFilled) return null;
    
    // Only validate future time if the date was changed by the user
    if (postScheduledFor !== originalScheduledFor) {
      const selected = new Date(postScheduledFor);
      const tenMinsFromNow = new Date(Date.now() + 10 * 60 * 1000);
      if (selected < tenMinsFromNow) {
        return "Schedule must be at least 10 minutes in the future.";
      }
    }
    
    return null;
  };

  const dateError = dateTouched ? getDateError() : null;
  const isDateValid = isDateFilled && getDateError() === null;
  
  // Platform validation
  const validatePlatformSelection = (): string | null => {
    if (!isEditMode) return null;
    if (selectedPlatforms.length === 0) return "At least one platform must be selected";
    
    const disconnectedPlatforms = selectedPlatforms.filter(platform => !connectedPlatforms.includes(platform));
    if (disconnectedPlatforms.length > 0) {
      return `${disconnectedPlatforms[0]} account not connected`;
    }
    return null;
  };
  
  const platformValidationError = validatePlatformSelection();
  const isPlatformValid = !isEditMode || (selectedPlatforms.length > 0 && !platformValidationError);
  const isFormValid = isTitleValid && isDateValid && isPlatformValid && !descriptionError;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    requestAnimationFrame(() => setShowModal(true));
    document.body.style.overflow = "hidden";
    
    // Store the currently focused element to return focus later
    returnFocusRef.current = document.activeElement as HTMLElement;
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  // Focus management: Focus the title input when modal opens
  useEffect(() => {
    if (showModal && titleInputRef.current) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  // Focus trap within modal
  useEffect(() => {
    if (!showModal || !modalRef.current) return;

    const modal = modalRef.current;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

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
  }, [showModal]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!showModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseRequest();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal]);

  const handleCloseRequest = () => {
    setShowDiscardConfirm(true);
  };

  const doClose = () => {
    setShowModal(false);
    setTimeout(() => {
      clearUpload();
      onClose();
      // Return focus to the element that opened the modal
      if (returnFocusRef.current) {
        returnFocusRef.current.focus();
      }
    }, 250);
  };

  const handleSchedule = () => {
    // Add API logic here for scheduling post details
    openSelectPlatform();
  };

  const handleSaveDraft = async () => {
    // Pre-flight validation
    if (!postTitle.trim()) {
      setTitleTouched(true);
      setDraftError("Title is required");
      return;
    }

    if (isEditMode) {
      // Convert to draft mode for existing post
      setIsSavingDraft(true);
      setDraftError(null);

      try {
        const response = await fetch(`/api/posts/${postId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save as draft');
        }

        // Success - show toast notification
        showSuccess("Post saved as draft");
        
        // Refresh dashboard data
        try {
          const dashboardResponse = await fetch("/api/dashboard");
          if (!dashboardResponse.ok) {
            showError("Failed to refresh dashboard");
          }
          router.refresh();
        } catch (refreshError) {
          console.error("Error refreshing dashboard:", refreshError);
          showError("Failed to refresh dashboard");
        }
        
        // Close modal
        clearUpload();
        onClose();

      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const errorMsg = "Network error. Please check your connection and try again.";
          setDraftError(errorMsg);
          showError(errorMsg);
        } else {
          const errorMsg = error instanceof Error ? error.message : 'An error occurred while saving as draft. Please try again.';
          setDraftError(errorMsg);
          showError(errorMsg);
        }
      } finally {
        setIsSavingDraft(false);
      }
    } else {
      // Original draft save logic for new posts
      if (!fileKey || !videoFileName || !videoFileSize) {
        setDraftError("Video upload incomplete. Please upload a video first.");
        return;
      }

      setIsSavingDraft(true);
      setDraftError(null);

      try {
        const response = await fetch('/api/posts/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          window.location.href = '/login';
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save draft');
        }

        // Success
        setShowDraftSuccess(true);
        setTimeout(() => {
          clearUpload();
          onClose();
        }, 2000);

      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          setDraftError("Network error. Please check your connection and try again.");
        } else {
          setDraftError(error instanceof Error ? error.message : 'An error occurred while saving your draft. Please try again.');
        }
      } finally {
        setIsSavingDraft(false);
      }
    }
  };

  const handleUpdateSchedule = async () => {
    if (!isEditMode) return;
    
    // Trigger validation by marking fields as touched
    setTitleTouched(true);
    setDescriptionTouched(true);
    setDateTouched(true);
    
    // Check if form is valid
    if (!isFormValid) {
      if (titleError) {
        setUpdateError(titleError);
      } else if (descriptionError) {
        setUpdateError(descriptionError);
      } else if (dateError) {
        setUpdateError(dateError);
      } else if (platformValidationError) {
        setUpdateError(platformValidationError);
      }
      return;
    }
    
    setIsUpdating(true);
    setUpdateError(null);
    
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postTitle,
          description: postDescription || undefined,
          scheduledFor: postScheduledFor,
          selectedPlatforms: selectedPlatforms,
          timezone: userTimezone || 'UTC',
        }),
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update post');
      }
      
      // Success - show success toast notification
      showSuccess("Post updated successfully");
      
      // Refresh dashboard data
      try {
        const dashboardResponse = await fetch("/api/dashboard");
        if (!dashboardResponse.ok) {
          showError("Failed to refresh dashboard");
        }
        router.refresh();
      } catch (refreshError) {
        console.error("Error refreshing dashboard:", refreshError);
        showError("Failed to refresh dashboard");
      }
      
      // Close modal
      clearUpload();
      onClose();
      
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const errorMsg = "Network error. Please check your connection and try again.";
        setUpdateError(errorMsg);
        showError(errorMsg);
      } else {
        const errorMsg = error instanceof Error ? error.message : 'An error occurred while updating the post. Please try again.';
        setUpdateError(errorMsg);
        showError(errorMsg);
      }
    } finally {
      setIsUpdating(false);
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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-post-modal-title"
        className={`bg-surface/85 backdrop-blur-2xl w-full max-w-2xl max-h-[86dvh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border border-border/60 transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={handleCloseRequest}
          className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-surface/60 backdrop-blur-md border border-border/60 shadow-sm text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto py-6 custom-scrollbar">
          <h2 id="edit-post-modal-title" className="text-2xl md:text-3xl font-bold text-primary text-center mb-6">
            {isEditMode ? "Edit Scheduled Post" : "Edit & Schedule Post"}
          </h2>

          <div className={`grid grid-cols-1 ${!isEditMode ? 'md:grid-cols-[1fr_auto]' : ''} gap-4 sm:gap-6 px-4 sm:px-6 md:px-8`}>
            {/* Left Side: Details Form */}
            <div className="min-w-0 w-full">{/* Removed order classes since there's no right side in edit mode */}
              <div className="flex flex-col gap-5 w-full">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-main">
                      Post Title <span className="text-error">*</span>
                    </label>
                    <span className="text-xs text-text-secondary">{postTitle.length}/100</span>
                  </div>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={postTitle}
                    maxLength={100}
                    onChange={(e) => setPostTitle(e.target.value)}
                    onBlur={() => setTitleTouched(true)}
                    placeholder="Catchy title for your post..."
                    className={`w-full bg-surface/40 backdrop-blur-md border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-colors shadow-sm placeholder:text-text-secondary/50 ${
                      titleError
                        ? "border-error focus:border-error ring-1 ring-error/20"
                        : "border-border/60 focus:border-primary"
                    }`}
                    required
                  />
                  {/* Title validation error message */}
                  {titleError && (
                    <p className="text-xs text-error mt-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {titleError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-main">Description & Tags</label>
                    <span className="text-xs text-text-secondary">{postDescription.length}/250</span>
                  </div>
                  <textarea
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    onBlur={() => setDescriptionTouched(true)}
                    maxLength={250}
                    placeholder="Write a description, add some #hashtags..."
                    className={`w-full bg-surface/40 backdrop-blur-md border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-colors min-h-[140px] shadow-sm resize-none placeholder:text-text-secondary/50 custom-scrollbar ${
                      descriptionError
                        ? "border-error focus:border-error ring-1 ring-error/20"
                        : "border-border/60 focus:border-primary"
                    }`}
                  />
                  {/* Description validation error message */}
                  {descriptionError && (
                    <p className="text-xs text-error mt-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {descriptionError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-main">
                    Schedule Date & Time <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={postScheduledFor}
                      onChange={(e) => {
                        setPostScheduledFor(e.target.value);
                        setDateTouched(true);
                      }}
                      className={`w-full bg-surface/40 backdrop-blur-md border rounded-xl pl-4 pr-12 py-3 text-sm text-text-main shadow-sm focus:outline-none transition-colors dark:[color-scheme:dark] appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${
                        dateTouched && (!isDateFilled || dateError)
                          ? "border-error focus:border-error ring-1 ring-error/20"
                          : "border-border/60 focus:border-primary"
                      }`}
                      required
                    />
                    <div
                      className="group absolute right-[1px] top-[1px] bottom-[1px] w-12 bg-transparent flex items-center justify-center rounded-r-[11px] cursor-pointer hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={(e) => {
                        try {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          if (typeof input.showPicker === "function") {
                            input.showPicker();
                          }
                        } catch {
                          // ignore fallback
                        }
                      }}
                      title="Open Calendar"
                    >
                      <Calendar className="w-[18px] h-[18px] text-text-secondary group-hover:text-primary group-hover:drop-shadow-[0_0_8px_currentColor] group-active:scale-90 group-active:text-primary transition-all duration-300" />
                    </div>
                  </div>
                  {/* Date validation error message */}
                  {dateError && (
                    <p className="text-xs text-error mt-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {dateError}
                    </p>
                  )}
                  
                  {/* Timezone Information */}
                  {userTimezone ? (
                    <div className="mt-3 p-3 bg-surface/30 backdrop-blur-md border border-border/40 rounded-xl">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Globe2 className="w-4 h-4 text-primary" />
                        <span className="font-medium">Upload Timezone:</span>
                        <span className="font-semibold text-text-main">{userTimezone} ({getUTCOffset(userTimezone)})</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-warning/10 backdrop-blur-md border border-warning/30 rounded-xl">
                      <div className="flex items-center gap-2 text-xs text-warning">
                        <Globe2 className="w-4 h-4" />
                        <span className="font-medium">Timezone not set</span>
                      </div>
                      <div className="mt-1.5 text-xs text-warning">
                        Please set your timezone in preferences for accurate scheduling.
                      </div>
                    </div>
                  )}
                </div>

                {/* Platform Selection - Only show in edit mode */}
                {isEditMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-main">
                      Select Platforms <span className="text-error">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {APP_PLATFORMS.filter(p => connectedPlatforms.includes(p.name)).map((platform) => {
                        const isSelected = selectedPlatforms.includes(platform.name);
                        const isConnected = connectedPlatforms.includes(platform.name);
                        
                        return (
                          <label
                            key={platform.name}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border/60 bg-surface/40 hover:bg-surface-highlight"
                            } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isConnected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPlatforms(prev => [...prev, platform.name]);
                                } else {
                                  setSelectedPlatforms(prev => prev.filter(p => p !== platform.name));
                                }
                              }}
                              className="sr-only"
                            />
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={platform.icon}
                                alt={`${platform.name} logo`}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-text-main truncate">
                                {platform.name}
                              </div>
                              <div className="text-xs text-text-secondary">
                                {isConnected ? "Connected" : "Not connected"}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {platformValidationError && (
                      <p className="text-xs text-error mt-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {platformValidationError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Video Preview & Progress - Only show for new uploads */}
            {!isEditMode && (
              <div className="flex-shrink-0 w-[240px] order-first md:order-last mx-auto">
                {/* New post mode - show upload progress and preview */}
                <div className="bg-surface/40 backdrop-blur-md border border-border/60 shadow-sm rounded-2xl pt-4 px-4 flex flex-col items-center w-full">
                  <div className="flex items-center justify-center w-full">
                    <div className="rounded-xl overflow-hidden border border-border/60 bg-black flex items-center justify-center w-full max-w-[220px] aspect-[9/16]">
                      {previewUrl ? (
                        <video
                          src={previewUrl}
                          controls
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <div className="text-text-secondary p-6 text-center">
                          No preview available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full mt-2">
                    {uploadError ? (
                      <div className="mb-3">
                        <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/30 rounded-lg mb-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-error mb-1">Upload Failed</div>
                            <div className="text-xs text-error/90">{uploadError}</div>
                          </div>
                        </div>
                        {/* FIXED responsive gap- flex buttons for long error strings */}
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <label className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-secondary transition-all cursor-pointer text-center shadow-sm active:scale-95 leading-tight flex items-center justify-center">
                            Change Video
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                  clearError();
                                  handleUpload(files[0]);
                                }
                              }}
                            />
                          </label>
                          <button
                            onClick={() => {
                              if (previewUrl) {
                                clearError();
                                // Re-upload the same file
                                fetch(previewUrl)
                                  .then(res => res.blob())
                                  .then(blob => {
                                    const file = new File([blob], "video.mp4", { type: blob.type });
                                    handleUpload(file);
                                  })
                                  .catch(() => {
                                    // If retry fails, just clear the error and let user select new file
                                    clearError();
                                  });
                              }
                            }}
                            className="px-3 py-2.5 rounded-xl text-xs font-bold text-text-main border border-border/60 hover:bg-surface-highlight transition-all shadow-sm active:scale-95 w-full sm:w-auto"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-text-main">
                            {uploaded ? "Upload Complete" : "Uploading"}
                          </div>
                          <div className="text-xs text-text-secondary">{progress}%</div>
                        </div>
                        <div className="w-full bg-surface-highlight border border-border/40 rounded-full h-1.5 mb-3 overflow-hidden">
                          <div
                            className={`h-1.5 transition-all ${uploaded ? "bg-green-500" : "bg-primary"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-5 border-t border-border/60 bg-surface/40 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-4">
            {!isEditMode && (
              <button
                onClick={() => {
                  setShowModal(false);
                  setTimeout(() => goBackToUpload(), 250);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 text-text-main hover:bg-surface-highlight transition-colors shadow-sm active:scale-95"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}

            <button
              onClick={handleSaveDraft}
              disabled={postTitle.trim() === "" || isSavingDraft}
              className={`flex items-center gap-2 py-2.5 text-sm font-semibold transition-all ${
                postTitle.trim() === "" || isSavingDraft
                  ? "text-text-secondary/40 cursor-not-allowed"
                  : "text-text-secondary hover:text-text-main cursor-pointer active:scale-95"
              }`}
            >
              {isSavingDraft && <Loader2 size={16} className="animate-spin" />}
              {isSavingDraft ? "Saving..." : "Save as Draft"}
            </button>
          </div>

          {isEditMode ? (
            <button
              onClick={handleUpdateSchedule}
              disabled={!isFormValid || isUpdating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 ${
                !isFormValid || isUpdating
                  ? "bg-primary/60 cursor-not-allowed"
                  : "bg-primary hover:bg-secondary shadow-md hover:shadow-lg"
              }`}
            >
              {isUpdating && <Loader2 size={16} className="animate-spin" />}
              {isUpdating ? "Updating..." : "Update Schedule"}
            </button>
          ) : (
            <button
              onClick={handleSchedule}
              disabled={!isFormValid}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 ${
                !isFormValid
                  ? "bg-primary/60 cursor-not-allowed"
                  : "bg-primary hover:bg-secondary shadow-md hover:shadow-lg"
              }`}
            >
              Select Platform
            </button>
          )}
        </div>

        {/* Discard Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-2 text-text-main">Discard Post?</h3>
              <p className="text-sm text-text-secondary mb-6">
                If you leave now, you’ll lose your scheduled details and video.
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
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">Draft Saved!</h3>
              <p className="text-sm text-text-secondary text-center">
                Your post has been saved as a draft. You can continue editing it later from your dashboard.
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">Failed to Save Draft</h3>
              <p className="text-sm text-text-secondary text-center mb-6">
                {draftError}
              </p>
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

        {/* Load Post Error Message */}
        {loadPostError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-error" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">Failed to Load Post</h3>
              <p className="text-sm text-text-secondary text-center mb-6">
                {loadPostError}
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => {
                    setLoadPostError(null);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setLoadPostError(null);
                    fetchPostData();
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white shadow-md hover:shadow-lg active:scale-95 w-full sm:w-auto"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Error Message */}
        {updateError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-error" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-main text-center">Failed to Update Post</h3>
              <p className="text-sm text-text-secondary text-center mb-6">
                {updateError}
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setUpdateError(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSchedule}
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
