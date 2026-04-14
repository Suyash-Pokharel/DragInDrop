"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, ChevronLeft } from "lucide-react";
import { useModal } from "@/app/components/ModalProvider";

interface EditPostProps {
  onClose: () => void;
}

export default function EditPost({ onClose }: EditPostProps) {
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
  } = useModal();

  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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

  const isTitleValid = postTitle.trim() !== "";
  const isDateFilled = postScheduledFor.trim() !== "";

  // Must be at least 10 minutes in the future
  const getDateError = (): string | null => {
    if (!isDateFilled) return null;
    const selected = new Date(postScheduledFor);
    const tenMinsFromNow = new Date(Date.now() + 10 * 60 * 1000);
    if (selected < tenMinsFromNow) {
      return "Schedule must be at least 10 minutes in the future.";
    }
    return null;
  };

  const dateError = dateTouched ? getDateError() : null;
  const isDateValid = isDateFilled && getDateError() === null;
  const isFormValid = isTitleValid && isDateValid;

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

  const handleSchedule = () => {
    // Add API logic here for scheduling post details
    openSelectPlatform();
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

        <div className="overflow-y-auto py-6 custom-scrollbar">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-6">
            Edit & Schedule Post
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 sm:gap-6 px-4 sm:px-6 md:px-8">
            {/* Left Side: Details Form */}
            <div className="min-w-0 w-full order-last md:order-first">
              <div className="flex flex-col gap-5 w-full">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-main">
                      Post Title <span className="text-error">*</span>
                    </label>
                    <span className="text-xs text-text-secondary">{postTitle.length}/100</span>
                  </div>
                  <input
                    type="text"
                    value={postTitle}
                    maxLength={100}
                    onChange={(e) => setPostTitle(e.target.value)}
                    onBlur={() => setTitleTouched(true)}
                    placeholder="Catchy title for your post..."
                    className={`w-full bg-surface/40 backdrop-blur-md border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-colors shadow-sm placeholder:text-text-secondary/50 ${
                      titleTouched && !isTitleValid
                        ? "border-error focus:border-error ring-1 ring-error/20"
                        : "border-border/60 focus:border-primary"
                    }`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-main">Description & Tags</label>
                    <span className="text-xs text-text-secondary">{postDescription.length}/250</span>
                  </div>
                  <textarea
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    maxLength={250}
                    placeholder="Write a description, add some #hashtags..."
                    className="w-full bg-surface/40 backdrop-blur-md border border-border/60 rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary transition-colors min-h-[140px] shadow-sm resize-none placeholder:text-text-secondary/50 custom-scrollbar"
                  />
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
                </div>
              </div>
            </div>

            {/* Right Side: Video Preview & Progress */}
            {/* Fixed-width column — takes only what the video naturally needs */}
            <div className="flex-shrink-0 w-[240px] order-first md:order-last mx-auto">
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
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-5 border-t border-border/60 bg-surface/40 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-4">
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

            <button
              onClick={() => {
                // Future Save as Draft logic
                console.log("Saving as draft...");
              }}
              disabled={!isTitleValid}
              className={`py-2.5 text-sm font-semibold transition-all ${
                !isTitleValid
                  ? "text-text-secondary/40 cursor-not-allowed"
                  : "text-text-secondary hover:text-text-main cursor-pointer active:scale-95"
              }`}
            >
              Save as Draft
            </button>
          </div>

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
      </div>
    </div>,
    document.body,
  );
}
