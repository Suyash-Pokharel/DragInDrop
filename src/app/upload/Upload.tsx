"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import UploadDropzone from "@/app/upload/UploadDropzone";
import { useModal } from "@/app/components/ModalProvider";
import { uploadService } from "@/lib/uploadService";

interface UploadProps {
  onClose: () => void;
}

export default function Upload({ onClose }: UploadProps) {
  const { file, uploading, progress, previewUrl, handleUpload, openEditPost, clearUpload, uploadError, clearError } =
    useModal();

  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

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
    if (dirty || file) {
      setShowDiscardConfirm(true);
      return;
    }
    doClose();
  };

  const doClose = () => {
    setShowModal(false);
    setTimeout(() => {
      clearUpload();
      onClose();
    }, 250);
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
            Upload a Video
          </h2>

          {/* Error Message Display */}
          {uploadError && (
            <div className="mx-8 mb-4 p-4 bg-error/10 border border-error/30 rounded-lg flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5 text-error"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-error font-medium">{uploadError}</p>
              </div>
              <button
                onClick={clearError}
                className="flex-shrink-0 text-error/60 hover:text-error transition-colors"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-stretch gap-4 sm:gap-6 px-4 sm:px-6 md:px-8 pb-4">
            <div className="w-full flex flex-col h-full">
              <UploadDropzone
                accept="video/*"
                onFiles={(f: File[]) => {
                  if (!f || f.length === 0) return;

                  const selectedFile = f[0];

                  // Client-side validation for file type
                  if (!selectedFile.type.startsWith("video/")) {
                    clearError(); // Clear any existing error first
                    setTimeout(() => {
                      // Use a custom error event to set the error message
                      const errorEvent = new CustomEvent("error", {
                        detail: { message: "Only video files are allowed", code: "INVALID_TYPE" },
                      });
                      uploadService.dispatchEvent(errorEvent);
                    }, 0);
                    return;
                  }

                  // Client-side validation for file size (250MB = 262,144,000 bytes)
                  if (selectedFile.size > 262144000) {
                    clearError(); // Clear any existing error first
                    setTimeout(() => {
                      const errorEvent = new CustomEvent("error", {
                        detail: { message: "File size exceeds 250MB limit", code: "FILE_TOO_LARGE" },
                      });
                      uploadService.dispatchEvent(errorEvent);
                    }, 0);
                    return;
                  }

                  if (uploading) {
                    setPendingFiles(f);
                    setShowReplaceConfirm(true);
                    return;
                  }

                  setDirty(true);
                  handleUpload(selectedFile);
                }}
                files={file ? [file] : []}
              />
            </div>

            <div className="flex-shrink-0 w-[240px] flex">
              <div className="bg-surface/40 backdrop-blur-md border border-border/60 shadow-sm rounded-2xl p-4 flex flex-col items-center w-full h-full justify-between">
                <div className="flex items-center justify-center w-full flex-1 mb-4">
                  <div className="rounded-xl overflow-hidden border border-border/60 bg-black flex items-center justify-center w-full max-h-full max-w-[220px] aspect-[9/16]">
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

                <div className="w-full mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-text-main">Uploading</div>
                    <div className="text-xs text-text-secondary">{progress}%</div>
                  </div>
                  <div className="w-full bg-surface-highlight border border-border/40 rounded-full h-1.5 mb-3 overflow-hidden">
                    <div
                      className="h-1.5 bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-5 border-t border-border/60 bg-surface/40 backdrop-blur-md">
          <button
            onClick={() => setShowDiscardConfirm(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 text-text-main hover:bg-surface-highlight transition-colors shadow-sm active:scale-95"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              setShowModal(false);
              setTimeout(() => openEditPost(), 250);
            }}
            disabled={!file}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 ${
              !file ? "bg-primary/60 cursor-not-allowed" : "bg-primary hover:bg-secondary shadow-md hover:shadow-lg"
            }`}
          >
            Continue to Details
          </button>
        </div>

        {/* Modals for Replace / Discard */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-2 text-text-main">Discard Video?</h3>
              <p className="text-sm text-text-secondary mb-6">
                You’ll permanently lose the uploaded video.
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
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showReplaceConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border/60 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-2 text-text-main">Replace File?</h3>
              <p className="text-sm text-text-secondary mb-6">
                A file is currently uploading. Replace it?
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReplaceConfirm(false);
                    setPendingFiles(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 hover:bg-surface-highlight shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Keep uploading
                </button>
                <button
                  onClick={() => {
                    if (pendingFiles && pendingFiles.length > 0) {
                      const selectedFile = pendingFiles[0];

                      if (!selectedFile.type.startsWith("video/")) {
                        setPendingFiles(null);
                        setShowReplaceConfirm(false);
                        clearError();
                        setTimeout(() => {
                          const errorEvent = new CustomEvent("error", {
                            detail: { message: "Only video files are allowed", code: "INVALID_TYPE" },
                          });
                          uploadService.dispatchEvent(errorEvent);
                        }, 0);
                        return;
                      }

                      if (selectedFile.size > 262144000) {
                        setPendingFiles(null);
                        setShowReplaceConfirm(false);
                        clearError();
                        setTimeout(() => {
                          const errorEvent = new CustomEvent("error", {
                            detail: { message: "File size exceeds 250MB limit", code: "FILE_TOO_LARGE" },
                          });
                          uploadService.dispatchEvent(errorEvent);
                        }, 0);
                        return;
                      }

                      setDirty(true);
                      handleUpload(selectedFile);
                    }
                    setPendingFiles(null);
                    setShowReplaceConfirm(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white shadow-md hover:shadow-lg active:scale-95 w-full sm:w-auto"
                >
                  Yes, replace
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
