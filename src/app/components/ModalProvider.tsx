"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Upload from "../upload/Upload";
import EditPost from "../upload/EditPost";
import NoAccountModal from "../upload/NoAccountModal";
import SelectPlatform from "../upload/SelectPlatform";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { uploadService } from "@/lib/uploadService";
import { useUser } from "./UserProvider";
import { useToast } from "./ToastProvider";

type ModalContextType = {
  isUploadOpen: boolean;
  openUpload: (initialFiles?: File[] | null) => void;
  closeUpload: () => void;

  isEditPostOpen: boolean;
  openEditPost: (postId?: string) => void; // Add optional postId parameter
  closeEditPost: () => void;
  goBackToUpload: () => void;

  isSelectPlatformOpen: boolean;
  openSelectPlatform: () => void;
  closeSelectPlatform: () => void;
  goBackToEditPost: () => void;

  // Edit mode state
  editingPostId: string | null;

  // Delete confirmation modal state
  isDeleteConfirmationOpen: boolean;
  postToDelete: { postId: string; postTitle: string } | null;
  openDeleteConfirmation: (postId: string, postTitle: string) => void;
  closeDeleteConfirmation: () => void;

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
  
  // Error handling
  uploadError: string | null;
  clearError: () => void;

  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;

  // File metadata
  fileKey: string | null;
  videoFileName: string | null;
  videoFileSize: number | null;

  // Post metadata
  postTitle: string;
  setPostTitle: (title: string) => void;
  postDescription: string;
  setPostDescription: (description: string) => void;
  postScheduledFor: string;
  setPostScheduledFor: (scheduledFor: string) => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
};

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const { status } = useSession();
  const router = useRouter();
  const { connectedPlatforms } = useUser();
  const { showSuccess, showError } = useToast();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [isSelectPlatformOpen, setIsSelectPlatformOpen] = useState(false);
  const [isNoAccountModalOpen, setIsNoAccountModalOpen] = useState(false);

  // Edit mode state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // Delete confirmation modal state
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<{ postId: string; postTitle: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Background Upload States
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // File metadata
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFileSize, setVideoFileSize] = useState<number | null>(null);

  // Post metadata
  const [postTitle, setPostTitle] = useState<string>("");
  const [postDescription, setPostDescription] = useState<string>("");
  const [postScheduledFor, setPostScheduledFor] = useState<string>("");

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
    const unsubStart = uploadService.onStart(() => {
      setUploading(true);
      setUploadError(null); // Clear any previous errors
    });
    const unsubProg = uploadService.onProgress((pct: number) => setProgress(pct));
    const unsubDone = uploadService.onDone(
      ({ status, responseText }: { status: number; responseText: string }) => {
        setUploading(false);
        if (status >= 200 && status < 300) {
          setProgress(100);
          setUploaded(true);
          setUploadError(null);
          
          // Parse upload response to extract fileKey
          try {
            const responseData = JSON.parse(responseText);
            console.log("Upload response data:", responseData);
            if (responseData.fileKey) {
              console.log("Setting fileKey in context:", responseData.fileKey);
              setFileKey(responseData.fileKey);
            } else {
              console.error("No fileKey in upload response!");
            }
          } catch (error) {
            console.error("Failed to parse upload response:", error);
          }
        } else {
          setUploaded(false);
          setUploadError("Upload failed. Please try again.");
          console.error("Upload failed with status:", status);
        }
      },
    );

    const unsubError = uploadService.onError((detail: { message: string; code?: string }) => {
      setUploading(false);
      setUploaded(false);
      
      console.log("Error detail received:", detail);
      
      // Handle authentication errors by redirecting to login
      if (detail.code === "AUTH_FAILED") {
        console.error("Authentication failed during upload");
        router.push("/login");
        return;
      }
      
      // Set user-friendly error message with fallback
      const errorMessage = detail?.message || "An unexpected error occurred. Please try again.";
      setUploadError(errorMessage);
      console.error("Upload error occurred:", detail);
    });

    const unsubAbort = uploadService.onAbort(() => {
      setUploading(false);
      setProgress(0);
      setUploaded(false);
      setUploadError(null);
    });

    return () => {
      unsubStart();
      unsubProg();
      unsubDone();
      unsubError();
      unsubAbort();
    };
  }, [router]);

  const handleUpload = useCallback(
    (fileToUpload: File) => {
      updateFileState(fileToUpload);
      setUploaded(false);
      setProgress(0);
      setUploadError(null); // Clear any previous errors
      
      // Clear previous fileKey when starting new upload
      setFileKey(null);
      
      // Store videoFileName and videoFileSize from file
      setVideoFileName(fileToUpload.name);
      setVideoFileSize(fileToUpload.size);
      
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
    setUploadError(null);
  }, []);

  const clearUpload = useCallback(() => {
    abortUpload();
    updateFileState(null);
    setSelectedDate(null);
    
    // Reset all file metadata
    setFileKey(null);
    setVideoFileName(null);
    setVideoFileSize(null);
    
    // Reset post metadata
    setPostTitle("");
    setPostDescription("");
    setPostScheduledFor("");
  }, [abortUpload, updateFileState]);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  const openUpload = useCallback(
    (files?: File[] | null) => {
      // Check authentication status
      if (status === "unauthenticated") {
        router.push("/login");
        return;
      }

      // Don't proceed if session is still loading
      if (status === "loading") {
        return;
      }

      // Check if user has connected platforms
      if (connectedPlatforms.length === 0) {
        setIsNoAccountModalOpen(true);
        return;
      }

      // Process files and open upload modal
      if (files && files.length > 0) {
        handleUpload(files[0]);
      }
      setIsUploadOpen(true);
    },
    [status, router, handleUpload, connectedPlatforms],
  );

  const closeUpload = useCallback(() => {
    setIsUploadOpen(false);
  }, []);

  const openEditPost = useCallback((postId?: string) => {
    setIsUploadOpen(false);
    setEditingPostId(postId || null);
    setIsEditPostOpen(true);
  }, []);

  const closeEditPost = useCallback(() => {
    setIsEditPostOpen(false);
    setEditingPostId(null);
  }, []);

  const goBackToUpload = useCallback(() => {
    setIsEditPostOpen(false);
    setIsUploadOpen(true);
  }, []);

  const openSelectPlatform = useCallback(() => {
    setIsEditPostOpen(false);
    setIsSelectPlatformOpen(true);
  }, []);

  const closeSelectPlatform = useCallback(() => {
    setIsSelectPlatformOpen(false);
  }, []);

  const goBackToEditPost = useCallback(() => {
    setIsSelectPlatformOpen(false);
    setIsEditPostOpen(true);
  }, []);

  const closeNoAccountModal = useCallback(() => {
    setIsNoAccountModalOpen(false);
  }, []);

  const openDeleteConfirmation = useCallback((postId: string, postTitle: string) => {
    setPostToDelete({ postId, postTitle });
    setIsDeleteConfirmationOpen(true);
  }, []);

  const closeDeleteConfirmation = useCallback(() => {
    setIsDeleteConfirmationOpen(false);
    setPostToDelete(null);
  }, []);

  const handleDeletePost = useCallback(async () => {
    if (!postToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${postToDelete.postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete post");
      }

      // Close the modal
      closeDeleteConfirmation();

      // Show success toast notification
      showSuccess("Post deleted successfully");

      // Refresh dashboard data
      try {
        const dashboardResponse = await fetch("/api/dashboard");
        if (!dashboardResponse.ok) {
          showError("Failed to refresh dashboard");
        }
        // Trigger a page refresh to update the dashboard
        router.refresh();
      } catch (refreshError) {
        console.error("Error refreshing dashboard:", refreshError);
        showError("Failed to refresh dashboard");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      // Show error toast notification with API error message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showError("Network error. Please check your connection and try again.");
      } else {
        showError(error instanceof Error ? error.message : "Failed to delete post");
      }
    } finally {
      setIsDeleting(false);
    }
  }, [postToDelete, closeDeleteConfirmation, showSuccess, showError, router]);

  return (
    <ModalContext.Provider
      value={{
        isUploadOpen,
        openUpload,
        closeUpload,
        isEditPostOpen,
        openEditPost,
        closeEditPost,
        goBackToUpload,
        isSelectPlatformOpen,
        openSelectPlatform,
        closeSelectPlatform,
        goBackToEditPost,
        editingPostId,
        isDeleteConfirmationOpen,
        postToDelete,
        openDeleteConfirmation,
        closeDeleteConfirmation,
        file,
        setFile: updateFileState,
        uploading,
        progress,
        uploaded,
        previewUrl,
        handleUpload,
        abortUpload,
        clearUpload,
        uploadError,
        clearError,
        selectedDate,
        setSelectedDate,
        fileKey,
        videoFileName,
        videoFileSize,
        postTitle,
        setPostTitle,
        postDescription,
        setPostDescription,
        postScheduledFor,
        setPostScheduledFor,
      }}
    >
      {children}
      {isUploadOpen && <Upload onClose={closeUpload} />}
      {isEditPostOpen && <EditPost onClose={closeEditPost} postId={editingPostId || undefined} />}
      {isSelectPlatformOpen && <SelectPlatform onClose={closeSelectPlatform} />}
      {isNoAccountModalOpen && <NoAccountModal onClose={closeNoAccountModal} />}
      <DeleteConfirmationModal
        postTitle={postToDelete?.postTitle || null}
        isOpen={isDeleteConfirmationOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeletePost}
        isDeleting={isDeleting}
      />
    </ModalContext.Provider>
  );
};

export default ModalProvider;
