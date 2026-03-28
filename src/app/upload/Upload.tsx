"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import UploadDropzone from "@/app/upload/UploadDropzone";
import { useModal } from "@/app/components/ModalProvider";

interface UploadProps {
  onClose: () => void;
}

export default function Upload({ onClose }: UploadProps) {
  const {
    file,
    uploading,
    progress,
    uploaded,
    previewUrl,
    handleUpload,
    openEditPost,
    clearUpload,
  } = useModal();

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
            Upload a Video
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 place-items-center-safe gap-4">
            <div className="min-w-0 w-full ml-8 xl:ml-12 flex justify-center lg:justify-end">
              <UploadDropzone
                accept="video/*"
                onFiles={(f: File[]) => {
                  if (!f || f.length === 0) return;

                  if (uploading) {
                    setPendingFiles(f);
                    setShowReplaceConfirm(true);
                    return;
                  }

                  setDirty(true);
                  handleUpload(f[0]);
                }}
                files={file ? [file] : []}
              />
            </div>

            <div className="flex justify-center min-w-0">
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-text-main">
                      Uploading
                    </div>
                    <div className="text-xs text-text-secondary">
                      {progress}%
                    </div>
                  </div>
                  <div className="w-full bg-surface rounded-full h-1.5 mb-3 overflow-hidden">
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

        <div className="flex items-center justify-between gap-4 p-4 border-t border-border bg-surface">
          <button
            onClick={() => setShowDiscardConfirm(true)}
            className="px-4 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-highlight transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              setShowModal(false);
              setTimeout(() => openEditPost(), 250);
            }}
            disabled={!file}
            className={`px-6 py-2 rounded-md text-sm font-medium text-white ${
              !file
                ? "bg-primary/60 cursor-not-allowed"
                : "bg-primary hover:bg-secondary shadow-md"
            } transition-colors`}
          >
            Continue to Details
          </button>
        </div>

        {/* Modals for Replace / Discard */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Discard Video?</h3>
              <p className="text-sm text-text-secondary mb-4">
                You’ll permanently lose the uploaded video.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2 rounded-md text-sm border border-border hover:bg-surface-highlight"
                >
                  Continue editing
                </button>
                <button
                  onClick={doClose}
                  className="px-4 py-2 rounded-md text-sm bg-error text-white hover:opacity-95"
                >
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showReplaceConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Replace File?</h3>
              <p className="text-sm text-text-secondary mb-4">
                A file is currently uploading. Replace it?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReplaceConfirm(false);
                    setPendingFiles(null);
                  }}
                  className="px-4 py-2 rounded-md text-sm border border-border hover:bg-surface-highlight"
                >
                  No, keep uploading
                </button>
                <button
                  onClick={() => {
                    if (pendingFiles && pendingFiles.length > 0) {
                      setDirty(true);
                      handleUpload(pendingFiles[0]);
                    }
                    setPendingFiles(null);
                    setShowReplaceConfirm(false);
                  }}
                  className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:opacity-95"
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
