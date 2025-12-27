"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Lock, Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";

// --- MOVED OUTSIDE THE COMPONENT ---
const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <li className={`flex items-center gap-2 text-xs transition-colors duration-200 ${met ? "text-success font-medium" : "text-text-secondary"}`}>
        {met ? (
            <Check size={14} className="shrink-0" strokeWidth={3} />
        ) : (
            <Circle size={8} className="shrink-0 fill-current opacity-50" />
        )}
        <span>{text}</span>
    </li>
);

export default function CreatePassword() {
    const router = useRouter();

    // State
    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    });
    
    // Visibility State
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Focus & Validation State
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [touched, setTouched] = useState({ password: false, confirmPassword: false });
    const [isLoading, setIsLoading] = useState(false);

    // --- PASSWORD STRENGTH LOGIC ---
    const passwordLen = formData.password.length;
    const hasMinLength = passwordLen >= 8;
    const hasLower = /[a-z]/.test(formData.password);
    const hasUpper = /[A-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSymbol = /[^A-Za-z0-9]/.test(formData.password);

    const isPasswordValid = hasMinLength && hasLower && hasUpper && hasNumber && hasSymbol;

    // --- CONFIRM PASSWORD LOGIC ---
    const confirmLen = formData.confirmPassword.length;
    const passwordsMatch = formData.password === formData.confirmPassword;

    // Error States
    // 1. Password Field
    const isPasswordInvalid = touched.password && !isPasswordValid;
    
    // 2. Confirm Field
    const isConfirmEmpty = touched.confirmPassword && confirmLen === 0;
    const isMatchError = touched.confirmPassword && confirmLen > 0 && !passwordsMatch;
    // General flag for red border on confirm input
    const isConfirmInvalid = isConfirmEmpty || isMatchError;

    // --- BUTTON ENABLE LOGIC ---
    // Button is enabled ONLY if: Password is Valid AND Confirm isn't empty AND they match
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!canSubmit) {
            setTouched({ password: true, confirmPassword: true });
            return;
        }

        setIsLoading(true);

        // Simulate API Call
        setTimeout(() => {
            setIsLoading(false);
            router.push("/dashboard");
        }, 1500);
    };

    return (
        <div className="w-full flex justify-center p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-text-main mb-2">Set Password</h1>
                    <p className="text-text-secondary text-sm">
                        Create a secure password to finish setting up your account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    {/* New Password */}
                    <div className="space-y-1.5">
                        <label 
                            htmlFor="newPassword"
                            className="block text-sm font-medium text-text-main"
                        >
                            Password
                            
                            {/* --- CONDITIONAL ERROR MESSAGES --- */}
                            {touched.password && !isPasswordFocused && (
                                <>
                                    {passwordLen === 0 && (
                                        <span className="inline-error">REQUIRED</span>
                                    )}
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
                                className={`input-base ${isPasswordInvalid && !isPasswordFocused ? "input-error" : "input-default"}`}
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
                            Confirm Password
                            {/* ERROR LOGIC: Empty -> REQUIRED, Mismatch -> DOESN'T MATCH */}
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
                        // DISABLE LOGIC: Loading OR Not Valid OR Don't Match OR Confirm Empty
                        disabled={isLoading || !canSubmit}
                        className="w-full py-3 px-4 mt-8 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            "Login"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}