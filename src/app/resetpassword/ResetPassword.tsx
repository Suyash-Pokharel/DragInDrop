"use client";

import React, { useState, Suspense } from "react";
import { Eye, EyeOff, Lock, Check, Circle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Reveal } from "../components/Reveal";
import { resetPassword } from "../actions/auth";
import { passwordCriteria } from "@/lib/password";

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <li
    className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
      met ? "text-success font-medium" : "text-text-secondary"
    }`}
  >
    {met ? (
      <Check size={14} className="shrink-0" strokeWidth={3} />
    ) : (
      <Circle size={8} className="shrink-0 fill-current opacity-50" />
    )}
    <span>{text}</span>
  </li>
);

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  // Visibility State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus & Validation State
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // --- PASSWORD STRENGTH LOGIC (shared) ---
  const passwordLen = formData.password.length;
  const { hasMinLength, hasLower, hasUpper, hasNumber, hasSymbol } = passwordCriteria(
    formData.password,
  );

  const isPasswordValid = hasMinLength && hasLower && hasUpper && hasNumber && hasSymbol;

  // --- CONFIRM PASSWORD LOGIC ---
  const confirmLen = formData.confirmPassword.length;
  const passwordsMatch = formData.password === formData.confirmPassword;

  // Error States
  const isPasswordInvalid = touched.password && !isPasswordValid;
  const isConfirmEmpty = touched.confirmPassword && confirmLen === 0;
  const isMatchError = touched.confirmPassword && confirmLen > 0 && !passwordsMatch;
  const isConfirmInvalid = isConfirmEmpty || isMatchError;

  // --- BUTTON ENABLE LOGIC ---
  const canSubmit = isPasswordValid && confirmLen > 0 && passwordsMatch;

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched({ ...touched, [field]: true });
    if (field === "password") setIsPasswordFocused(false);
  };

  const handleFocus = () => {
    setIsPasswordFocused(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      setTouched({ password: true, confirmPassword: true });
      return;
    }

    if (!token) {
      alert("Invalid or missing reset link. Please request a new password reset.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword(token, formData.password);

      if (result.success) {
        // Auto-login using NextAuth signIn with credentials
        const signInResult = await signIn("credentials", {
          email: result.email,
          password: formData.password,
          redirect: false,
        });

        if (signInResult?.ok) {
          router.push("/dashboard");
        } else {
          alert("Password reset successfully, but auto-login failed. Please log in manually.");
          router.push("/login");
        }
      } else {
        alert(result.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Reveal width="100%" delay={0.05}>
      <div className="w-full flex justify-center p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <div className="text-center mb-8">
            <Reveal width="100%" delay={0.1}>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Lock size={32} />
              </div>
            </Reveal>
            <Reveal width="100%" delay={0.15}>
              <h1 className="text-3xl font-bold text-text-main mb-2">Reset Password</h1>
              <p className="text-text-secondary text-sm">
                Create a new secure password for your account.
              </p>
            </Reveal>
          </div>
          <Reveal width="100%" delay={0.2}>
            <form onSubmit={handleSubmit} className="space-y-2">
              {/* New Password */}
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-main">
                  New Password
                  {touched.password && !isPasswordFocused && (
                    <>
                      {passwordLen === 0 && <span className="inline-error">REQUIRED</span>}
                      {passwordLen > 0 && !hasMinLength && (
                        <span className="inline-error">MIN 8 CHARS</span>
                      )}
                      {hasMinLength && !isPasswordValid && (
                        <span className="inline-error">WEAK PASSWORD</span>
                      )}
                    </>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="password"
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isLoading}
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur("password")}
                    onFocus={handleFocus}
                    className={`input-base ${
                      isPasswordInvalid && !isPasswordFocused ? "input-error" : "input-default"
                    }`}
                  />
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* SLIDING REQUIREMENTS CHECKLIST */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isPasswordFocused ? "max-h-40 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
                  }`}
                >
                  <ul className="grid grid-cols-2 gap-y-1 gap-x-10 bg-background/50 p-3 rounded-lg border border-border/50">
                    <RequirementItem met={hasMinLength} text="8+ Characters" />
                    <RequirementItem met={hasUpper} text="Uppercase (A-Z)" />
                    <RequirementItem met={hasLower} text="Lowercase (a-z)" />
                    <RequirementItem met={hasNumber} text="Number (0-9)" />
                    <RequirementItem met={hasSymbol} text="Symbol (!@#$)" />
                  </ul>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-main"
                >
                  Confirm New Password
                  {isConfirmEmpty && <span className="inline-error">REQUIRED</span>}
                  {isMatchError && <span className="inline-error">DOESN&apos;T MATCH</span>}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    disabled={isLoading}
                    placeholder="••••••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => handleBlur("confirmPassword")}
                    className={`input-base ${isConfirmInvalid ? "input-error" : "input-default"}`}
                  />
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className="w-full py-3 px-4 mt-8 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </Reveal>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-text-main">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
