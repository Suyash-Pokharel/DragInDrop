/**
 * Client-side API request handler with comprehensive error handling
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import type { ApiError } from "@/types/user";

/**
 * Options for handleApiRequest
 */
export interface ApiRequestOptions<T> {
  /**
   * Callback invoked when the request succeeds
   */
  onSuccess?: (data: T) => void;
  
  /**
   * Callback invoked when the request fails
   */
  onError?: (error: string) => void;
  
  /**
   * Whether the request should be retried on recoverable errors
   * Recoverable errors: 500, 503, 504, network errors
   */
  retryable?: boolean;
  
  /**
   * Maximum number of retry attempts (default: 2)
   */
  maxRetries?: number;
  
  /**
   * Delay between retries in milliseconds (default: 1000)
   */
  retryDelay?: number;
  
  /**
   * Whether to preserve form data in sessionStorage on session expiry
   */
  preserveFormData?: boolean;
  
  /**
   * Key to use for sessionStorage when preserving form data
   */
  storageKey?: string;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is recoverable (can be retried)
 */
function isRecoverableError(status: number): boolean {
  return status === 500 || status === 503 || status === 504;
}

/**
 * Get default error message for a given HTTP status code
 */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Your session has expired. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "A conflict occurred. Please refresh and try again.";
    case 500:
    case 503:
    case 504:
      return "Server error. Please try again later.";
    default:
      return "An unexpected error occurred.";
  }
}

/**
 * Handle API requests with comprehensive error handling and retry logic
 * 
 * This utility provides:
 * - Consistent error handling across all HTTP status codes
 * - Automatic retry for recoverable errors (500, 503, 504, network errors)
 * - Session expiry detection and handling
 * - Network error detection
 * - Form data preservation on session expiry
 * 
 * @param request - Function that returns a fetch Promise
 * @param options - Configuration options for error handling and retries
 * @returns The parsed response data, or null if the request failed
 * 
 * @example
 * ```typescript
 * const data = await handleApiRequest<UserResponse>(
 *   () => fetch('/api/user/me'),
 *   {
 *     onSuccess: (data) => console.log('User data:', data),
 *     onError: (error) => setError(error),
 *     retryable: true,
 *   }
 * );
 * ```
 */
export async function handleApiRequest<T>(
  request: () => Promise<Response>,
  options: ApiRequestOptions<T> = {}
): Promise<T | null> {
  const {
    onSuccess,
    onError,
    retryable = false,
    maxRetries = 2,
    retryDelay = 1000,
    preserveFormData = false,
    storageKey,
  } = options;

  let lastError: string | null = null;
  let attempts = 0;

  while (attempts <= (retryable ? maxRetries : 0)) {
    try {
      const response = await request();

      // Handle successful response
      if (response.ok) {
        const data = await response.json();
        onSuccess?.(data);
        return data;
      }

      // Parse error response
      const errorData: ApiError = await response.json().catch(() => ({
        error: getDefaultErrorMessage(response.status),
      }));

      // Handle different HTTP status codes
      switch (response.status) {
        case 400:
          // Validation error - not retryable
          lastError = errorData.error || "Invalid request. Please check your input.";
          onError?.(lastError);
          return null;

        case 401:
          // Session expired - redirect to login
          lastError = "Your session has expired. Please log in again.";
          
          // Preserve form data if requested
          if (preserveFormData && storageKey) {
            // Note: Form data should be saved by the caller before making the request
            sessionStorage.setItem(`${storageKey}_timestamp`, Date.now().toString());
          }
          
          // Store return URL
          sessionStorage.setItem("returnUrl", window.location.pathname);
          
          onError?.(lastError);
          
          // Redirect after a short delay to allow error message to be displayed
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
          
          return null;

        case 403:
          // Forbidden - not retryable
          lastError = "You don't have permission to perform this action.";
          onError?.(lastError);
          return null;

        case 404:
          // Not found - not retryable
          lastError = errorData.error || "The requested resource was not found.";
          onError?.(lastError);
          return null;

        case 409:
          // Conflict - not retryable
          lastError = errorData.error || "A conflict occurred. Please refresh and try again.";
          onError?.(lastError);
          return null;

        case 500:
        case 503:
        case 504:
          // Server errors - retryable
          lastError = errorData.error || "Server error. Please try again later.";
          
          if (retryable && attempts < maxRetries) {
            attempts++;
            await sleep(retryDelay * attempts); // Exponential backoff
            continue; // Retry
          }
          
          onError?.(lastError);
          return null;

        default:
          // Unknown error
          lastError = errorData.error || "An unexpected error occurred.";
          onError?.(lastError);
          return null;
      }
    } catch (error) {
      // Network error or other exception
      if (error instanceof TypeError && error.message.includes("fetch")) {
        lastError = "Network error. Please check your connection and try again.";
        
        if (retryable && attempts < maxRetries) {
          attempts++;
          await sleep(retryDelay * attempts); // Exponential backoff
          continue; // Retry
        }
      } else {
        lastError = "An unexpected error occurred. Please try again.";
      }

      onError?.(lastError);
      return null;
    }

    // If we reach here without continuing, break the loop
    break;
  }

  return null;
}

/**
 * Restore form data from sessionStorage after session expiry
 * 
 * @param storageKey - Key used to store the form data
 * @param maxAge - Maximum age of stored data in milliseconds (default: 1 hour)
 * @returns The restored form data, or null if not found or expired
 * 
 * @example
 * ```typescript
 * const savedData = restoreFormData<FormData>('userDetailsFormData');
 * if (savedData) {
 *   setFormData(savedData);
 * }
 * ```
 */
export function restoreFormData<T>(
  storageKey: string,
  maxAge: number = 60 * 60 * 1000 // 1 hour
): T | null {
  try {
    const savedData = sessionStorage.getItem(storageKey);
    const timestamp = sessionStorage.getItem(`${storageKey}_timestamp`);

    if (!savedData || !timestamp) {
      return null;
    }

    // Check if data is expired
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > maxAge) {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_timestamp`);
      return null;
    }

    return JSON.parse(savedData) as T;
  } catch {
    return null;
  }
}

/**
 * Clear form data from sessionStorage
 * 
 * @param storageKey - Key used to store the form data
 * 
 * @example
 * ```typescript
 * clearFormData('userDetailsFormData');
 * ```
 */
export function clearFormData(storageKey: string): void {
  sessionStorage.removeItem(storageKey);
  sessionStorage.removeItem(`${storageKey}_timestamp`);
}
