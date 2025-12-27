"use client";

import React, { useState, useEffect } from "react";
import { X, Mail } from "lucide-react";

interface ForgetPasswordProps {
    onClose: () => void;
}

export default function ForgetPassword({ onClose }: ForgetPasswordProps) {
    // Animation State
    const [showModal, setShowModal] = useState(false);

    // Logic State
    const [view, setView] = useState<"input" | "success">("input");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // Validation State
    const [touched, setTouched] = useState(false);
    const isEmailError = touched && email.trim() === "";

    // --- FORM VALIDITY CHECK ---
    const isFormValid = email.trim() !== "";

    // 1. Trigger Open Animation & Lock Scroll
    useEffect(() => {
        requestAnimationFrame(() => setShowModal(true));
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    // 2. Handle Close Animation
    const handleClose = () => {
        setShowModal(false); // Trigger exit animation
        setTimeout(onClose, 300); // Wait for animation to finish before unmounting
    };

    // 3. Handle Submit Logic
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // --- FIX: Block submit if empty & show error ---
        if (!email.trim()) {
            setTouched(true); // Force the error to show
            return; // Stop the function here
        }

        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            setView("success");
        }, 1000);
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${showModal ? "opacity-100" : "opacity-0"
                }`}
        >
            {/* Modal Container with Scale/Fade Transition */}
            <div
                className={`w-full max-w-md bg-surface rounded-2xl shadow-2xl relative border border-border transition-all duration-300 ease-out transform ${showModal
                    ? "scale-100 opacity-100 translate-y-0"
                    : "scale-95 opacity-0 translate-y-4"
                    }`}
            >
                {/* Close Button (Shared) */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full text-text-secondary hover:bg-surface-highlight hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>

                {/* --- VIEW 1: INPUT FORM --- */}
                {view === "input" && (
                    <div className="p-6 md:p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                <Mail size={32} />
                            </div>
                            <h2 className="text-3xl font-bold text-text-main mb-2">
                                Forgot password?
                            </h2>
                            <p className="text-text-secondary text-sm">
                                Want to recover your account? <br />
                                Enter your email address used to sign in.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5 text-left">
                                {/* Label with Error Logic */}
                                <label
                                    htmlFor="recoveryEmail"
                                    className="block text-sm font-medium text-text-main"
                                >
                                    Email
                                    {isEmailError && (
                                        <span className="inline-error">
                                            REQUIRED
                                        </span>
                                    )}
                                </label>

                                <input
                                    id="recoveryEmail"
                                    name="email"
                                    autoComplete="email"
                                    type="email"
                                    required
                                    disabled={isLoading}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    // Added: onBlur handler
                                    onBlur={() => setTouched(true)}
                                    placeholder="example@gmail.com"
                                    // Conditional styling
                                    className={`input-base ${isEmailError ? "input-error" : "input-default"
                                        }`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !isFormValid}
                                className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-all shadow-md hover:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    "Get Email"
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* --- VIEW 2: SUCCESS MESSAGE --- */}
                {view === "success" && (
                    <div className="p-6 md:p-8 text-center animate-in fade-in duration-300">
                        <h2 className="text-3xl font-bold text-text-main mb-2">
                            Check your email
                        </h2>
                        <p className="text-text-secondary text-sm mb-6">
                            We sent a recovery link to <br />
                            <strong className="text-md text-text-main">{email}</strong>
                        </p>

                        <p className="text-sm text-text-secondary/80 mb-6 bg-background py-3 px-4 rounded-lg border border-border">
                            Please click the link in the sent email to recover your account and reset the password.
                        </p>

                        <button
                            onClick={handleClose}
                            className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}