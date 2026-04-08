"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import Upload from "../upload/Upload";
import EditPost from "../upload/EditPost";
import NoAccountModal from "../upload/NoAccountModal";
import SelectPlatform from "../upload/SelectPlatform";
import { uploadService } from "@/lib/uploadService";
import { useUser } from "./UserProvider";

type ModalContextType = {
  isUploadOpen: boolean;
  openUpload: (initialFiles?: File[] | null) => void;
  closeUpload: () => void;

  isEditPostOpen: boolean;
  openEditPost: () => void;
  closeEditPost: () => void;

  isSelectPlatformOpen: boolean;
  openSelectPlatform: () => void;
  closeSelectPlatform: () => void;

  // Global Upload State
  file: File | null;
  setFile: (f: File | null) => void;
  uploading: boolean;
  progress: number;
  uploaded: boolean;
  previewUrl: string | null;
  handleUpload: (file: File) => void;
  abortUpload: () => void;
  clearUpload: () => void;

  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
};

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const { connectedPlatforms } = useUser();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [isSelectPlatformOpen, setIsSelectPlatformOpen] = useState(false);
  const [isNoAccountModalOpen, setIsNoAccountModalOpen] = useState(false);

  // Background Upload States
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const previewUrlRef = useRef<string | null>(null);

  const updateFileState = useCallback((newFile: File | null) => {
    setFile(newFile);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (newFile) {
      const newUrl = URL.createObjectURL(newFile);
      previewUrlRef.current = newUrl;
      setPreviewUrl(newUrl);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubStart = uploadService.onStart(() => setUploading(true));
    const unsubProg = uploadService.onProgress((pct: number) => setProgress(pct));
    const unsubDone = uploadService.onDone(
      ({ status }: { status: number; responseText: string }) => {
        setUploading(false);
        if (status >= 200 && status < 300) {
          setProgress(100);
          setUploaded(true);
        } else {
          setUploaded(false);
          console.error("Upload failed with status:", status);
        }
      },
    );

    const unsubError = uploadService.onError(() => {
      setUploading(false);
      setUploaded(false);
      console.error("Upload error occurred");
    });

    const unsubAbort = uploadService.onAbort(() => {
      setUploading(false);
      setProgress(0);
      setUploaded(false);
    });

    return () => {
      unsubStart();
      unsubProg();
      unsubDone();
      unsubError();
      unsubAbort();
    };
  }, []);

  const handleUpload = useCallback(
    (fileToUpload: File) => {
      updateFileState(fileToUpload);
      setUploaded(false);
      setProgress(0);
      uploadService.start(fileToUpload);
    },
    [updateFileState],
  );

  const abortUpload = useCallback(() => {
    try {
      uploadService.abort();
    } catch {
      /* ignore */
    }
    setUploading(false);
    setProgress(0);
    setUploaded(false);
  }, []);

  const clearUpload = useCallback(() => {
    abortUpload();
    updateFileState(null);
    setSelectedDate(null);
  }, [abortUpload, updateFileState]);

  const openUpload = useCallback(
    (files?: File[] | null) => {
      if (connectedPlatforms.length === 0) {
        setIsNoAccountModalOpen(true);
        return;
      }
      if (files && files.length > 0) {
        handleUpload(files[0]);
      }
      setIsUploadOpen(true);
    },
    [handleUpload, connectedPlatforms],
  );

  const closeUpload = useCallback(() => {
    setIsUploadOpen(false);
  }, []);

  const openEditPost = useCallback(() => {
    setIsUploadOpen(false);
    setIsEditPostOpen(true);
  }, []);

  const closeEditPost = useCallback(() => {
    setIsEditPostOpen(false);
  }, []);

  const openSelectPlatform = useCallback(() => {
    setIsEditPostOpen(false);
    setIsSelectPlatformOpen(true);
  }, []);

  const closeSelectPlatform = useCallback(() => {
    setIsSelectPlatformOpen(false);
  }, []);

  const closeNoAccountModal = useCallback(() => {
    setIsNoAccountModalOpen(false);
  }, []);

  return (
    <ModalContext.Provider
      value={{
        isUploadOpen,
        openUpload,
        closeUpload,
        isEditPostOpen,
        openEditPost,
        closeEditPost,
        isSelectPlatformOpen,
        openSelectPlatform,
        closeSelectPlatform,
        file,
        setFile: updateFileState,
        uploading,
        progress,
        uploaded,
        previewUrl,
        handleUpload,
        abortUpload,
        clearUpload,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
      {isUploadOpen && <Upload onClose={closeUpload} />}
      {isEditPostOpen && <EditPost onClose={closeEditPost} />}
      {isSelectPlatformOpen && <SelectPlatform onClose={closeSelectPlatform} />}
      {isNoAccountModalOpen && <NoAccountModal onClose={closeNoAccountModal} />}
    </ModalContext.Provider>
  );
};

export default ModalProvider;
