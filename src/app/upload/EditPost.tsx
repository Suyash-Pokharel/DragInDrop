"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar } from "lucide-react";
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
  const isDateValid = postScheduledFor.trim() !== "";
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
        className={`bg-background w-full max-w-2xl max-h-[86dvh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border border-border transition-all duration-300 ease-out transform ${
          showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={handleCloseRequest}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-surface text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto py-6 custom-scrollbar">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-6">
            Edit & Schedule Post
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Side: Details Form */}
            <div className="min-w-0 w-full ml-8 xl:ml-12 flex justify-center lg:justify-end order-last lg:order-first">
              <div className="flex flex-col gap-6 w-full max-w-xs xl:max-w-sm">
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
                    className={`w-full bg-surface border rounded-lg px-4 py-3 text-sm text-text-main focus:outline-none transition-colors placeholder:text-text-secondary/50 ${
                      titleTouched && !isTitleValid
                        ? "border-error focus:border-error ring-1 ring-error/20"
                        : "border-border focus:border-primary"
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
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary transition-colors min-h-[140px] resize-none placeholder:text-text-secondary/50 custom-scrollbar"
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
                      className={`w-full bg-surface border rounded-lg pl-4 pr-12 py-3 text-sm text-text-main focus:outline-none transition-colors dark:[color-scheme:dark] appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${
                        dateTouched && !isDateValid
                          ? "border-error focus:border-error ring-1 ring-error/20"
                          : "border-border focus:border-primary"
                      }`}
                      required
                    />
                    {/* Opaque cover block functions as the clickable custom Calendar button, masking native icons */}
                    <div
                      className="group absolute right-[1px] top-[1px] bottom-[1px] w-12 bg-surface flex items-center justify-center rounded-r-[7px] cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors"
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
                </div>
              </div>
            </div>

            {/* Right Side: Video Preview & Progress */}
            <div className="flex justify-center min-w-0 order-first lg:order-last">
              <div className="bg-surface border border-border rounded-lg pt-4 px-4 flex flex-col items-center w-auto">
                <div className="flex items-center justify-center">
                  <div className="rounded-md overflow-hidden border border-border bg-black flex items-center justify-center w-[198px] aspect-9/16">
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
                      <div className="flex gap-2">
                        <label className="flex-1 px-3 py-2 rounded-md text-sm font-medium text-white bg-primary hover:bg-secondary transition-colors cursor-pointer text-center">
                          Select Different Video
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
                          className="px-3 py-2 rounded-md text-sm font-medium text-text-main border border-border hover:bg-surface-highlight transition-colors"
                        >
                          Retry Upload
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
                      <div className="w-full bg-background border border-border rounded-full h-1.5 mb-3 overflow-hidden">
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-border bg-surface">
          <button
            onClick={() => setShowDiscardConfirm(true)}
            className="px-4 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-highlight transition-colors"
          >
            Cancel Post
          </button>

          <button
            onClick={handleSchedule}
            disabled={!isFormValid}
            className={`px-6 py-2 rounded-md text-sm font-medium text-white transition-colors ${
              !isFormValid
                ? "bg-primary/60 cursor-not-allowed"
                : "bg-primary hover:bg-secondary shadow-md"
            }`}
          >
            Select Platform
          </button>
        </div>

        {/* Discard Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Discard Post?</h3>
              <p className="text-sm text-text-secondary mb-4">
                If you leave now, you’ll lose your scheduled details and video.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2 rounded-md text-sm border border-border hover:bg-surface-highlight transition-colors"
                >
                  Continue editing
                </button>
                <button
                  onClick={doClose}
                  className="px-4 py-2 rounded-md text-sm bg-error text-white hover:opacity-95 transition-opacity"
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
