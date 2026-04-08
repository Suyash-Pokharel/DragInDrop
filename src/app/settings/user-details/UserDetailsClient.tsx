"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { User, Shield, Trash2, KeyRound, Camera, CheckCircle2 } from "lucide-react";
import { useUser } from "../../components/UserProvider";
import { PublicUser } from "@/lib/getCurrentUser";
import TwoFactorModal from "./TwoFactorModal";

interface UserDetailsClientProps {
  user: PublicUser;
}

/**
 * Client component for User Details page.
 * Handles interactive features: image upload, 2FA modal, form interactions.
 * Receives user data as props from parent Server Component.
 *
 * @param user - User data fetched server-side from database
 */
export default function UserDetailsClient({ user }: UserDetailsClientProps) {
  const { tempImage, setTempImage } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setTempImage(url);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">User Details</h2>
        <p className="text-text-secondary text-sm md:text-base">
          Update your personal information and secure your account.
        </p>
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
                onClick={() => fileInputRef.current?.click()}
                title="Change Profile Picture"
              >
                {tempImage || user?.image ? (
                  <Image
                    src={tempImage || user?.image || ""}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-text-secondary" />
                )}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] text-white font-medium">Upload</span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageChange}
              />
              {(tempImage || user?.image) && (
                <button
                  onClick={() => setTempImage(null)}
                  className="text-xs text-text-secondary hover:text-error transition-colors"
                >
                  Remove picture
                </button>
              )}
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 gap-4 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-main">Full Name</label>
                <input
                  type="text"
                  key={user?.id}
                  value={user?.name || ""}
                  readOnly
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm text-text-secondary focus:outline-none focus:border-primary transition-colors cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-main">Email Address</label>
                <input
                  type="email"
                  key={user?.id}
                  value={user?.email || ""}
                  readOnly
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm text-text-secondary focus:outline-none focus:border-primary transition-colors cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <button className="px-5 py-2 bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
              Save Changes
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
                <p className="text-xs text-text-secondary mt-0.5">
                  Ensure your account is using a long, random password to stay secure.
                </p>
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
                <p className="text-xs text-text-secondary mt-0.5">
                  Add additional security to your account using TOTP authenticators.
                </p>
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
