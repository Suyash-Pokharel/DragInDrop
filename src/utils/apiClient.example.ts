/**
 * Usage examples for the API client utility
 * 
 * This file demonstrates how to use handleApiRequest in various scenarios
 */

import { handleApiRequest, restoreFormData, clearFormData } from "./apiClient";
import type { UserResponse, UpdateUserRequest } from "@/types/user";

/**
 * Example 1: Simple GET request with error handling
 */
export async function fetchUserData(
  onSuccess: (data: UserResponse) => void,
  onError: (error: string) => void
) {
  const data = await handleApiRequest<UserResponse>(
    () => fetch("/api/user/me"),
    {
      onSuccess,
      onError,
    }
  );

  return data;
}

/**
 * Example 2: POST/PATCH request with retry logic
 */
export async function updateUserProfile(
  updates: UpdateUserRequest,
  onSuccess: (data: UserResponse) => void,
  onError: (error: string) => void
) {
  const data = await handleApiRequest<UserResponse>(
    () =>
      fetch("/api/user/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }),
    {
      onSuccess,
      onError,
      retryable: true, // Retry on 500/503/504 errors
      maxRetries: 2,
      retryDelay: 1000,
    }
  );

  return data;
}

/**
 * Example 3: Request with form data preservation on session expiry
 */
export async function saveUserDetailsWithFormPreservation(
  formData: UpdateUserRequest,
  onSuccess: (data: UserResponse) => void,
  onError: (error: string) => void
) {
  // Save form data before making the request
  sessionStorage.setItem("userDetailsFormData", JSON.stringify(formData));

  const data = await handleApiRequest<UserResponse>(
    () =>
      fetch("/api/user/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }),
    {
      onSuccess: (data) => {
        // Clear form data on success
        clearFormData("userDetailsFormData");
        onSuccess(data);
      },
      onError,
      preserveFormData: true,
      storageKey: "userDetailsFormData",
      retryable: true,
    }
  );

  return data;
}

/**
 * Example 4: Restore form data after session expiry
 */
export function restoreUserDetailsForm() {
  const savedData = restoreFormData<UpdateUserRequest>("userDetailsFormData");

  if (savedData) {
    console.log("Restored form data:", savedData);
    // Show notification to user
    // "Your unsaved changes have been restored"
    return savedData;
  }

  return null;
}

/**
 * Example 5: File upload with error handling
 */
export async function uploadProfilePicture(
  file: File,
  onSuccess: (data: { fileUrl: string; fileKey: string }) => void,
  onError: (error: string) => void
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "image");

  const data = await handleApiRequest<{ fileUrl: string; fileKey: string }>(
    () =>
      fetch("/api/upload", {
        method: "POST",
        body: formData,
      }),
    {
      onSuccess,
      onError,
      retryable: true, // Retry on network errors
    }
  );

  return data;
}

/**
 * Example 6: Using in a React component
 */
/*
import { useState } from "react";
import { handleApiRequest } from "@/utils/apiClient";
import type { UserResponse } from "@/types/user";

export function UserDetailsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserResponse | null>(null);

  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);

    await handleApiRequest<UserResponse>(
      () => fetch("/api/user/me"),
      {
        onSuccess: (data) => {
          setUserData(data);
          setIsLoading(false);
        },
        onError: (error) => {
          setError(error);
          setIsLoading(false);
        },
      }
    );
  };

  const saveUserData = async (updates: UpdateUserRequest) => {
    setIsLoading(true);
    setError(null);

    // Save form data before request
    sessionStorage.setItem("userDetailsFormData", JSON.stringify(updates));

    await handleApiRequest<UserResponse>(
      () =>
        fetch("/api/user/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }),
      {
        onSuccess: (data) => {
          setUserData(data);
          setIsLoading(false);
          clearFormData("userDetailsFormData");
          // Show success message
        },
        onError: (error) => {
          setError(error);
          setIsLoading(false);
        },
        preserveFormData: true,
        storageKey: "userDetailsFormData",
        retryable: true,
      }
    );
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {userData && <UserForm data={userData} onSave={saveUserData} />}
    </div>
  );
}
*/
