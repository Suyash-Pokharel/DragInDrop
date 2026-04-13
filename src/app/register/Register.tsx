"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import GoogleLogo from "../assets/logo/Google.webp";
import VerificationSent from "./VerificationSent";
import { Reveal } from "../components/Reveal";

// Client-side wrapper: call the API route which extracts IP and accepts a fingerprint.
async function callRegisterApi(data: { name: string; email: string; fingerprint?: string }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 1. Define Allowed Domains
const ALLOWED_DOMAINS = [
  "@gmail.com",
  "@icloud.com",
  "@outlook.com",
  "@hotmail.com",
  "@yahoo.com",
  ".edu",
];

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- VALIDATION HELPERS ---
  const isNameError = touched.name && formData.name.trim() === "";

  // Email Validation Logic
  const emailTrimmed = formData.email.trim().toLowerCase();
  const isEmailEmpty = emailTrimmed === "";
  // Check if email ends with any allowed domain
  const isEmailSupported = ALLOWED_DOMAINS.some((domain) => emailTrimmed.endsWith(domain));

  // Determine specific Email Error type
  const isEmailRequiredError = touched.email && isEmailEmpty;
  const isEmailDomainError = touched.email && !isEmailEmpty && !isEmailSupported;

  // General error flag for styling the input
  const isEmailError = isEmailRequiredError || isEmailDomainError;

  // --- FORM VALIDITY CHECK ---
  // Button enabled only if: Name filled AND Email Domain is allowed
  const isFormValid = formData.name.trim() !== "" && isEmailSupported;

  // --- HANDLERS ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation Check
    if (!formData.name.trim() || !isEmailSupported) {
      setTouched({ name: true, email: true });
      return;
    }

    setIsLoading(true);

    // Build a stable client fingerprint and store it in localStorage
    let fp: string | undefined;
    try {
      const key = "dragindrop_fp";
      fp = localStorage.getItem(key) || undefined;
      if (!fp && typeof navigator !== "undefined") {
        const raw = [
          navigator.userAgent,
          navigator.platform,
          screen.width,
          screen.height,
          navigator.language,
        ].join("|");
        try {
          fp = btoa(raw);
        } catch {
          fp = encodeURIComponent(raw);
        }
        try {
          localStorage.setItem(key, fp);
        } catch {}
      }
    } catch {}

    // 2. Call API wrapper which will extract IP server-side and pass fingerprint
    const result = await callRegisterApi({
      name: formData.name,
      email: formData.email,
      fingerprint: fp,
    });

    setIsLoading(false);

    // 3. Handle Success/Error
    if (result.success) {
      setShowSuccessModal(true);
    } else {
      // In a real app, you might want to show this error in the UI
      alert(result.error);
    }
  };

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <Reveal width="100%" delay={0.05}>
      <div className="w-full flex justify-center p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          {/* Header */}
          <Reveal width="100%" delay={0.1}>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-primary mb-2">DragInDrop</h1>
              <h2 className="text-text-secondary text-sm font-medium">Create Your New Account</h2>
            </div>
          </Reveal>

          {/* Form */}
          <Reveal width="100%" delay={0.15}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Row */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-sm font-medium text-text-main">
                  Full Name
                  {isNameError && <span className="inline-error">REQUIRED</span>}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur("name")}
                  className={`input-base ${isNameError ? "input-error" : "input-default"}`}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="registerEmail" className="block text-sm font-medium text-text-main">
                  Email
                  {isEmailRequiredError && <span className="inline-error">REQUIRED</span>}
                  {isEmailDomainError && <span className="inline-error">EMAIL NOT SUPPORTED</span>}
                </label>
                <input
                  id="registerEmail"
                  name="email"
                  autoComplete="email"
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="example@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur("email")}
                  className={`input-base ${isEmailError ? "input-error" : "input-default"}`}
                />
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-text-secondary text-center leading-relaxed px-6">
                By clicking &quot;Create Account&quot;, you agree to our{" "}
                <Link
                  href="/terms"
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full py-3 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Create Account"
                )}
              </button>

              {/* Login Link */}
              <div className="text-center text-sm text-text-secondary">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary font-semibold hover:text-secondary hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Login
                </Link>
              </div>
            </form>
          </Reveal>

          {/* Separator */}
          <Reveal width="100%" delay={0.2}>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <span className="relative bg-surface px-2 text-xs text-text-secondary tracking-wider font-medium">
                OR
              </span>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={() => handleOAuthSignIn("google")}
              className="w-full py-3 px-4 rounded-lg bg-background/50 border border-border text-text-main font-medium hover:bg-surface-highlight hover:border-text-secondary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 group"
            >
              <Image
                src={GoogleLogo}
                alt="Google Logo"
                width={20}
                height={20}
                className="group-hover:scale-110 transition-transform duration-200"
              />
              <span>Continue with Google</span>
            </button>
          </Reveal>
        </div>

        {/* --- SUCCESS MODAL COMPONENT --- */}
        {showSuccessModal && (
          <VerificationSent email={formData.email} onClose={() => setShowSuccessModal(false)} />
        )}
      </div>
    </Reveal>
  );
}
