/**
 * Facebook Pages Video Requirements Validation
 *
 * This module validates video requirements for Facebook Pages uploads.
 * It checks video format, file size, and caption length according to
 * Facebook's specifications and application-level constraints.
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Post data interface for validation
 */
export interface PostForValidation {
  videoFileKey: string;
  videoFileSize: number;
  title: string;
  description?: string;
}

/**
 * Validate video for Facebook Pages upload
 *
 * This function validates that a video meets Facebook Pages requirements:
 * - Format: MP4 or MOV (file extension check)
 * - File Size: Maximum 250 MB (application-level limit for performance)
 * - Caption Length: Maximum 2,200 characters (Facebook's video description limit)
 *
 * @param {PostForValidation} post - Post data to validate
 * @returns {ValidationResult} Validation result with success status and error message
 *
 * @example
 * const result = validateVideoForFacebook({
 *   videoFileKey: 'my-video.mp4',
 *   videoFileSize: 50 * 1024 * 1024, // 50 MB
 *   title: 'My Video Title',
 *   description: 'My video description'
 * });
 */
export function validateVideoForFacebook(post: PostForValidation): ValidationResult {
  // Validate video format is MP4 or MOV (file extension check)
  const videoFileKey = post.videoFileKey.toLowerCase();
  const isValidFormat = videoFileKey.endsWith(".mp4") || videoFileKey.endsWith(".mov");

  if (!isValidFormat) {
    //  Return error "Video format must be MP4 or MOV" for invalid format
    return {
      valid: false,
      error: "Video format must be MP4 or MOV",
    };
  }

  //  Validate video file size does not exceed 250 MB (application-level limit)
  const maxSize = 250 * 1024 * 1024; // 250 MB in bytes
  if (post.videoFileSize > maxSize) {
    //  Return error with explanation about application-level limit
    return {
      valid: false,
      error:
        "Video file size exceeds 250 MB limit (Facebook supports up to 10 GB, but this system enforces 250 MB for performance)",
    };
  }

  // Validate caption length and format
  // Format caption as title concatenated with description using double newline separator
  const caption = post.description ? `${post.title}\n\n${post.description}` : post.title; // Use title only when description is empty

  //  16.6: Validate caption length does not exceed 2,200 characters
  if (caption.length > 2200) {
    //  Return error "Caption exceeds 2,200 character limit" for long captions
    return {
      valid: false,
      error: "Caption exceeds 2,200 character limit",
    };
  }

  // All validations passed
  return {
    valid: true,
  };
}

/**
 * Format caption for Facebook Pages video
 *
 * This function formats the caption by concatenating title and description
 * with a double newline separator, or uses title only if description is empty.
 *
 * @param {string} title - Video title
 * @param {string} [description] - Video description (optional)
 * @returns {string} Formatted caption
 *
 * @example
 * const caption1 = formatCaptionForFacebook('My Title', 'My description');
 * // Returns: 'My Title\n\nMy description'
 *
 * const caption2 = formatCaptionForFacebook('My Title');
 * // Returns: 'My Title'
 */
export function formatCaptionForFacebook(title: string, description?: string): string {
  // Format caption as title concatenated with description using double newline separator
  // Use title only as caption when description is empty
  return description ? `${title}\n\n${description}` : title;
}

/**
 * Get video file type from file extension
 *
 * This function determines the MIME type based on the file extension
 * for use in Facebook's upload session initialization.
 *
 * @param {string} videoFileKey - Video file key/name
 * @returns {string} MIME type for the video file
 *
 * @example
 * const type1 = getVideoFileType('video.mp4');
 * // Returns: 'video/mp4'
 *
 * const type2 = getVideoFileType('video.mov');
 * // Returns: 'video/quicktime'
 */
export function getVideoFileType(videoFileKey: string): string {
  const lowerKey = videoFileKey.toLowerCase();

  if (lowerKey.endsWith(".mp4")) {
    return "video/mp4";
  } else if (lowerKey.endsWith(".mov")) {
    return "video/quicktime";
  }

  // Default to mp4 if unknown (should not happen after validation)
  return "video/mp4";
}

/**
 * Validate video file extension only
 *
 * This is a helper function that only validates the file format
 * without checking file size or caption length.
 *
 * @param {string} videoFileKey - Video file key/name
 * @returns {ValidationResult} Validation result for format only
 *
 * @example
 * const result = validateVideoFormat('video.mp4');
 * // Returns: { valid: true }
 */
export function validateVideoFormat(videoFileKey: string): ValidationResult {
  const lowerKey = videoFileKey.toLowerCase();
  const isValidFormat = lowerKey.endsWith(".mp4") || lowerKey.endsWith(".mov");

  if (!isValidFormat) {
    return {
      valid: false,
      error: "Video format must be MP4 or MOV",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate video file size only
 *
 * This is a helper function that only validates the file size
 * without checking format or caption length.
 *
 * @param {number} videoFileSize - Video file size in bytes
 * @returns {ValidationResult} Validation result for file size only
 *
 * @example
 * const result = validateVideoFileSize(50 * 1024 * 1024); // 50 MB
 * // Returns: { valid: true }
 */
export function validateVideoFileSize(videoFileSize: number): ValidationResult {
  const maxSize = 250 * 1024 * 1024; // 250 MB in bytes

  if (videoFileSize > maxSize) {
    return {
      valid: false,
      error:
        "Video file size exceeds 250 MB limit (Facebook supports up to 10 GB, but this system enforces 250 MB for performance)",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate caption length only
 *
 * This is a helper function that only validates the caption length
 * without checking format or file size.
 *
 * @param {string} title - Video title
 * @param {string} [description] - Video description (optional)
 * @returns {ValidationResult} Validation result for caption length only
 *
 * @example
 * const result = validateCaptionLength('Title', 'Description');
 * // Returns: { valid: true }
 */
export function validateCaptionLength(title: string, description?: string): ValidationResult {
  const caption = formatCaptionForFacebook(title, description);

  if (caption.length > 2200) {
    return {
      valid: false,
      error: "Caption exceeds 2,200 character limit",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Log validation failure with context
 *
 * This function logs validation failures with userId, postId, and specific validation error
 * for debugging and monitoring purposes.
 *
 * @param {string} userId - User ID
 * @param {string} postId - Post ID
 * @param {string} validationError - Specific validation error message
 *
 * Log validation failures with userId, postId, and specific validation error
 */
export function logValidationFailure(
  userId: string,
  postId: string,
  validationError: string,
): void {
  console.error("[Facebook Pages Video Validation] Validation failed:", {
    userId,
    postId,
    validationError,
    timestamp: new Date().toISOString(),
  });
}
