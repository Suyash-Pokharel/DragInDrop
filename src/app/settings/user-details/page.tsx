"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { User, Shield, Trash2, KeyRound, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useUser } from "../../components/UserProvider";
import { AvatarInitials } from "../../components/AvatarInitials";
import TwoFactorModal from "./TwoFactorModal";

// Helper function to check if URL is a Google profile picture
const isGoogleProfilePic = (url: string | null): boolean => {
  return url?.includes('googleusercontent.com') ?? false;
};

// Helper function to check if URL is a B2 storage URL (should show remove button)
const shouldShowRemoveButton = (url: string | null): boolean => {
  if (!url) return false;
  // Only show remove button for B2 URLs (not Google profile pictures)
  return !isGoogleProfilePic(url);
};

export default function UserDetailsPage() {
  const { 
    firstName, 
    lastName, 
    email, 
    profilePic, 
    isLoading, 
    error, 
    setUserData 
  } = useUser();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [localProfilePic, setLocalProfilePic] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form data when user data loads
  useEffect(() => {
    if (firstName || lastName || email) {
      setFormData({
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
      });
    }
  }, [firstName, lastName, email]);

  // Restore form data from sessionStorage if available (after session expiry)
  useEffect(() => {
    const savedData = sessionStorage.getItem('userDetailsFormData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
        // Show notification that data was restored
        setSaveError('Your unsaved changes have been restored.');
        setTimeout(() => {
          setSaveError(null);
        }, 5000);
      } catch {
        sessionStorage.removeItem('userDetailsFormData');
      }
    }
  }, []);

  // Reset image load error when profilePic changes
  useEffect(() => {
    setImageLoadError(false);
  }, [profilePic]);

  // Sync localProfilePic with profilePic from context
  useEffect(() => {
    setLocalProfilePic(profilePic);
  }, [profilePic]);

  // Email validation regex (RFC 5322 standard)
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate firstName
    if (!formData.firstName || formData.firstName.trim() === '') {
      errors.firstName = 'First name is required';
    }

    // Validate lastName
    if (!formData.lastName || formData.lastName.trim() === '') {
      errors.lastName = 'Last name is required';
    }

    // Validate email
    if (!formData.email || formData.email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if form is valid (for disabling save button)
  const isFormValid = (): boolean => {
    return (
      formData.firstName.trim() !== '' &&
      formData.lastName.trim() !== '' &&
      formData.email.trim() !== '' &&
      validateEmail(formData.email)
    );
  };

  const handleSave = async () => {
    // Validate form before saving
    if (!validateForm()) {
      return;
    }

    // Save form data to sessionStorage before request
    sessionStorage.setItem('userDetailsFormData', JSON.stringify(formData));

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        switch (response.status) {
          case 400:
            // Validation error
            setSaveError(errorData.error || 'Invalid request. Please check your input.');
            break;
          case 401:
            // Session expired
            setSaveError('Your session has expired. Redirecting to login...');
            setTimeout(() => {
              sessionStorage.setItem('returnUrl', window.location.pathname);
              window.location.href = '/login';
            }, 2000);
            break;
          case 409:
            // Conflict error (email already in use or concurrent update)
            setSaveError(errorData.error || 'A conflict occurred. Please refresh and try again.');
            break;
          case 500:
            // Server error
            setSaveError(errorData.error || 'Server error. Please try again later.');
            break;
          default:
            setSaveError('An unexpected error occurred. Please try again.');
        }
        return;
      }

      // Success - update UserProvider with new data
      const updatedData = await response.json();
      setUserData({
        firstName: updatedData.firstName,
        lastName: updatedData.lastName,
        email: updatedData.email,
      });

      // Clear sessionStorage on success
      sessionStorage.removeItem('userDetailsFormData');

      // Display success message
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

    } catch (error) {
      // Network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setSaveError('Network error. Please check your connection and try again.');
      } else {
        setSaveError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select an image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setUploadError('Image must be smaller than 5MB');
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalProfilePic(previewUrl);
    setUploadError(null);

    // Upload to B2
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { fileUrl } = await response.json();
      
      // Update local state and UserProvider with B2 URL
      setLocalProfilePic(fileUrl);
      setUserData({ profilePic: fileUrl });
      
      // Clean up preview URL
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      // Revert to original profile pic on error
      setLocalProfilePic(profilePic);
    } finally {
      setIsUploading(false);
    }
  };

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
        <div className="mb-2">
          <h2 className="text-2xl font-semibold text-text-main mb-1">User Details</h2>
          <p className="text-text-secondary text-sm md:text-base">Update your personal information and secure your account.</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Show error message if data fetch failed
  if (error) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
        <div className="mb-2">
          <h2 className="text-2xl font-semibold text-text-main mb-1">User Details</h2>
          <p className="text-text-secondary text-sm md:text-base">Update your personal information and secure your account.</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-error text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">User Details</h2>
        <p className="text-text-secondary text-sm md:text-base">Update your personal information and secure your account.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
        
        {/* Profile Info */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Profile Information</h3>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 mt-2">
            
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3 md:pr-4 md:border-r border-border shrink-0">
              <div 
                className="relative w-24 h-24 rounded-full overflow-hidden border border-border group cursor-pointer bg-surface-highlight flex items-center justify-center shadow-sm"
                onClick={() => !isUploading && fileInputRef.current?.click()}
                title={isUploading ? "Uploading..." : "Change Profile Picture"}
              >
                {localProfilePic && !imageLoadError ? (
                  <Image 
                    src={localProfilePic} 
                    alt="Profile" 
                    fill 
                    className="object-cover" 
                    onError={() => setImageLoadError(true)}
                  />
                ) : firstName ? (
                  <AvatarInitials firstName={firstName} size={96} />
                ) : (
                  <User className="w-10 h-10 text-text-secondary" />
                )}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 text-white mb-1 animate-spin" />
                      <span className="text-[10px] text-white font-medium">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-white mb-1" />
                      <span className="text-[10px] text-white font-medium">Upload</span>
                    </>
                  )}
                </div>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleImageChange}
                disabled={isLoading || isUploading}
              />
              {uploadError && (
                <p className="text-xs text-error text-center max-w-[120px]">{uploadError}</p>
              )}
              {shouldShowRemoveButton(localProfilePic) && !isUploading && (
                <button 
                  onClick={async () => {
                    const currentPic = localProfilePic;
                    
                    // Set profilePic to null in local state immediately
                    setLocalProfilePic(null);
                    setUserData({ profilePic: null });
                    
                    // Try to delete from B2 storage if it's a B2 URL
                    if (currentPic && currentPic.includes('backblazeb2.com')) {
                      try {
                        // Extract file key from URL
                        // URL format: https://s3.eu-central-003.backblazeb2.com/file/{bucket_name}/{file_key}
                        const urlParts = currentPic.split('/file/');
                        if (urlParts.length === 2) {
                          const pathParts = urlParts[1].split('/');
                          // Remove bucket name, keep the rest as file key
                          const fileKey = pathParts.slice(1).join('/');
                          
                          const response = await fetch('/api/upload/delete', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ fileKey }),
                          });
                          
                          if (!response.ok) {
                            // Log error but don't revert - user already sees picture removed
                            console.error('Failed to delete file from B2:', await response.text());
                          }
                        }
                      } catch (error) {
                        // Log error but continue - user experience is not affected
                        console.error('Error deleting profile picture from B2:', error);
                      }
                    }
                  }} 
                  className="text-xs text-text-secondary hover:text-error transition-colors"
                  disabled={isLoading}
                >
                  Remove picture
                </button>
              )}
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-main">First Name</label>
              <input 
                type="text" 
                value={formData.firstName} 
                onChange={(e) => {
                  setFormData({ ...formData, firstName: e.target.value });
                  // Clear validation error for this field
                  if (validationErrors.firstName) {
                    setValidationErrors({ ...validationErrors, firstName: '' });
                  }
                }}
                disabled={isLoading} 
                className={`w-full bg-background/50 border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none transition-colors disabled:cursor-not-allowed disabled:text-text-secondary ${
                  validationErrors.firstName ? 'border-error focus:border-error' : 'border-border focus:border-primary'
                }`}
              />
              {validationErrors.firstName && (
                <p className="text-xs text-error">{validationErrors.firstName}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-main">Last Name</label>
              <input 
                type="text" 
                value={formData.lastName} 
                onChange={(e) => {
                  setFormData({ ...formData, lastName: e.target.value });
                  // Clear validation error for this field
                  if (validationErrors.lastName) {
                    setValidationErrors({ ...validationErrors, lastName: '' });
                  }
                }}
                disabled={isLoading} 
                className={`w-full bg-background/50 border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none transition-colors disabled:cursor-not-allowed disabled:text-text-secondary ${
                  validationErrors.lastName ? 'border-error focus:border-error' : 'border-border focus:border-primary'
                }`}
              />
              {validationErrors.lastName && (
                <p className="text-xs text-error">{validationErrors.lastName}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-medium text-text-main">Email Address</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  // Clear validation error for this field
                  if (validationErrors.email) {
                    setValidationErrors({ ...validationErrors, email: '' });
                  }
                }}
                disabled={isLoading}
                className={`w-full bg-background border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none transition-colors disabled:cursor-not-allowed disabled:text-text-secondary ${
                  validationErrors.email ? 'border-error focus:border-error' : 'border-border focus:border-primary'
                }`}
              />
              {validationErrors.email && (
                <p className="text-xs text-error">{validationErrors.email}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Success Message */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <p className="text-sm text-primary font-medium">Profile updated successfully</p>
          </div>
        )}

        {/* Error Message */}
        {saveError && (
          <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg flex flex-col gap-2">
            <p className="text-sm text-error">{saveError}</p>
            {(saveError.includes('Server error') || saveError.includes('Network error')) && (
              <button
                onClick={handleSave}
                className="self-start px-3 py-1.5 bg-error/20 hover:bg-error/30 text-error text-xs font-medium rounded transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}
        
        <div className="mt-2 flex justify-end">
            <button 
              className="px-5 py-2 bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isLoading || !isFormValid() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </section>

        {/* Security & Authentication */}
        <section className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Security</h3>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background border border-border p-4 rounded-xl">
            <div className="flex gap-4">
              <div className="p-2 bg-surface-highlight rounded-lg flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h4 className="font-semibold text-text-main text-sm">Change Password</h4>
                <p className="text-xs text-text-secondary mt-0.5">Ensure your account is using a long, random password to stay secure.</p>
              </div>
            </div>
            <button className="px-4 py-2 border border-border hover:bg-surface-highlight hover:border-text-secondary text-text-main text-sm font-medium rounded-lg transition-all whitespace-nowrap">
              Update Password
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background border border-border p-4 rounded-xl">
            <div className="flex gap-4">
              <div className="p-2 bg-surface-highlight rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h4 className="font-semibold text-text-main text-sm">Two-Factor Authentication</h4>
                <p className="text-xs text-text-secondary mt-0.5">Add additional security to your account using TOTP authenticators.</p>
              </div>
            </div>
            
            {is2FAEnabled ? (
              <button 
                onClick={() => setIs2FAEnabled(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-highlight border border-border text-text-main text-sm font-medium rounded-lg transition-all whitespace-nowrap hover:bg-error/10 hover:text-error hover:border-error/20"
              >
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Active (Disable)
              </button>
            ) : (
              <button 
                onClick={() => setShow2FAModal(true)}
                className="px-4 py-2 border border-border hover:bg-surface-highlight hover:border-text-secondary text-text-main text-sm font-medium rounded-lg transition-all whitespace-nowrap"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2 border-b border-error/20 pb-2 mb-2">
            <Trash2 className="w-5 h-5 text-error" />
            <h3 className="text-lg font-medium text-error">Danger Zone</h3>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <div className="mt-2">
              <button className="px-4 py-2 border border-error/50 bg-error/10 hover:bg-error hover:text-white text-error text-sm font-medium rounded-lg transition-colors shadow-sm">
                Delete Account
              </button>
            </div>
          </div>
        </section>

      </div>

      {show2FAModal && (
        <TwoFactorModal 
          onClose={() => setShow2FAModal(false)}
          onSuccess={() => setIs2FAEnabled(true)}
        />
      )}
    </div>
  );
}
