/**
 * Facebook Pages API Integration Module - Main Exports
 *
 * This module exports the main functions and types for Facebook Pages video upload integration.
 * It provides a clean interface for other parts of the application to use Facebook API functionality.
 */

// Export main API functions
export {
  initializeUploadSession,
  uploadVideoFile,
  publishVideo,
  refreshFacebookToken,
} from "./api";

// Export types for external usage
export type {
  InitializeUploadSessionParams,
  InitializeUploadSessionResponse,
  UploadVideoFileParams,
  UploadVideoFileResponse,
  PublishVideoParams,
  PublishVideoResponse,
  RefreshFacebookTokenParams,
  RefreshFacebookTokenResponse,
} from "./api";

// Export example functions for documentation/testing
export {
  exampleFacebookVideoUpload,
  exampleTokenRefresh,
  exampleErrorHandling,
  exampleVideoValidation,
} from "./example";
