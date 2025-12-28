"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
// Removed 'X' from import as it is now in the other file
import GoogleLogo from "../assets/logo/Google.webp";
// Import the new component
import VerificationSent from "./VerificationSent";
import { Reveal } from "../components/Reveal";

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
  // --- STATE ---
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- VALIDATION HELPERS ---
  const isFirstNameError =
    touched.firstName && formData.firstName.trim() === "";
  const isLastNameError = touched.lastName && formData.lastName.trim() === "";

  // Email Validation Logic
  const emailTrimmed = formData.email.trim().toLowerCase();
  const isEmailEmpty = emailTrimmed === "";
  // Check if email ends with any allowed domain
  const isEmailSupported = ALLOWED_DOMAINS.some((domain) =>
    emailTrimmed.endsWith(domain)
  );

  // Determine specific Email Error type
  const isEmailRequiredError = touched.email && isEmailEmpty;
  const isEmailDomainError =
    touched.email && !isEmailEmpty && !isEmailSupported;

  // General error flag for styling the input
  const isEmailError = isEmailRequiredError || isEmailDomainError;

  // --- FORM VALIDITY CHECK ---
  // Button enabled only if: First Name filled, Last Name filled, AND Email Domain is allowed
  const isFormValid =
    formData.firstName.trim() !== "" &&
    formData.lastName.trim() !== "" &&
    isEmailSupported;

  // --- HANDLERS ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 2. Block submission if any validation fails
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !isEmailSupported // Block if email domain is not supported
    ) {
      setTouched({ firstName: true, lastName: true, email: true });
      return;
    }

    setIsLoading(true);

    // Simulate API Call
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccessModal(true);
    }, 1500);
  };

  return (
    <Reveal width="100%" delay={0.05}>
      <div className="w-full flex justify-center p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          {/* Header */}
          <Reveal width="100%" delay={0.1}>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-primary mb-2">DragInDrop</h1>
              <h2 className="text-text-secondary text-sm font-medium">
                Create Your New Account
              </h2>
            </div>
          </Reveal>

          {/* Form */}
          <Reveal width="100%" delay={0.15}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Row */}
              <div className="flex gap-4">
                {/* First Name */}
                <div className="space-y-1.5 w-1/2">
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-text-main"
                  >
                    First Name
                    {isFirstNameError && (
                      <span className="inline-error">REQUIRED</span>
                    )}
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    onBlur={() => handleBlur("firstName")}
                    className={`input-base ${isFirstNameError ? "input-error" : "input-default"
                      }`}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-1.5 w-1/2">
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-text-main"
                  >
                    Last Name
                    {isLastNameError && (
                      <span className="inline-error">REQUIRED</span>
                    )}
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    onBlur={() => handleBlur("lastName")}
                    className={`input-base ${isLastNameError ? "input-error" : "input-default"
                      }`}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="registerEmail"
                  className="block text-sm font-medium text-text-main"
                >
                  Email
                  {isEmailRequiredError && (
                    <span className="inline-error">REQUIRED</span>
                  )}
                  {isEmailDomainError && (
                    <span className="inline-error">EMAIL NOT SUPPORTED</span>
                  )}
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
                  className={`input-base ${isEmailError ? "input-error" : "input-default"
                    }`}
                />
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-text-secondary text-center leading-relaxed px-11">
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
            <button className="w-full py-3 px-4 rounded-lg bg-background/50 border border-border text-text-main font-medium hover:bg-surface-highlight hover:border-text-secondary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 group">
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
          <VerificationSent
            email={formData.email}
            onClose={() => setShowSuccessModal(false)}
          />
        )}
      </div>
    </Reveal>
  );
}
