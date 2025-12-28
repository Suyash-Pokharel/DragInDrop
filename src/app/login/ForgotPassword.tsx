"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Loader2, MailCheck } from "lucide-react";
import { Reveal } from "../components/Reveal";

interface ForgetPasswordProps {
    onClose: () => void;
}

export default function ForgetPassword({ onClose }: ForgetPasswordProps) {
    const [view, setView] = useState<"input" | "success">("input");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Validation State
    const [touched, setTouched] = useState(false);
    const isEmailError = touched && email.trim() === "";
    const isFormValid = email.trim() !== "";

    // Animation & Mount State
    const [showModal, setShowModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    // 1. Handle Mounting (Solves Hydration Mismatch)
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // 2. Handle Animation & Scroll Lock
    useEffect(() => {
        if (!mounted) return;

        requestAnimationFrame(() => setShowModal(true));
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mounted]);

    const handleClose = () => {
        setShowModal(false);
        setTimeout(onClose, 300);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setTouched(true);
            return;
        }

        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            setView("success");
        }, 1500);
    };

    if (!mounted) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${showModal ? "opacity-100" : "opacity-0"
                }`}
        >
            {/* Modal Container */}
            <div
                className={`w-full max-w-md bg-surface rounded-2xl shadow-2xl relative border border-border transition-all duration-300 ease-out transform ${showModal ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
                    }`}
            >
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full text-text-secondary hover:bg-surface-highlight hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>

                {/* --- VIEW 1: INPUT FORM --- */}
                {view === "input" && (
                    <div className="p-6 md:p-8">
                        <Reveal width="100%" delay={0.05}>
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                    <Mail size={32} />
                                </div>
                                <h2 className="text-3xl font-bold text-text-main mb-2">
                                    Forgot password?
                                </h2>
                                <p className="text-text-secondary text-sm">
                                    Enter your email address and we&apos;ll send you a link to reset your password.
                                </p>
                            </div>
                        </Reveal>

                        <Reveal width="100%" delay={0.1}>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-1.5 text-left">
                                    <label
                                        htmlFor="recoveryEmail"
                                        className="block text-sm font-medium text-text-main"
                                    >
                                        Email
                                        {isEmailError && (
                                            <span className="inline-error">REQUIRED</span>
                                        )}
                                    </label>

                                    <input
                                        id="recoveryEmail"
                                        name="email"
                                        autoComplete="email"
                                        type="email"
                                        disabled={isLoading}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => setTouched(true)}
                                        placeholder="example@gmail.com"
                                        className={`input-base ${isEmailError ? "input-error" : "input-default"}`}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !isFormValid}
                                    className="w-full py-3 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        "Get Email"
                                    )}
                                </button>
                            </form>
                        </Reveal>
                    </div>
                )}

                {/* --- VIEW 2: SUCCESS MESSAGE --- */}
                {view === "success" && (
                    <div className="p-6 md:p-8 text-center animate-in fade-in duration-300">
                        <Reveal width="100%" delay={0.1}>
                            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 text-success">
                                <MailCheck size={32} strokeWidth={2.5} />
                            </div>
                        </Reveal>

                        <Reveal width="100%" delay={0.2}>
                            <h2 className="text-3xl font-bold text-text-main mb-3 tracking-tight">
                                Check your email
                            </h2>
                            <p className="text-text-secondary text-base mb-4 leading-relaxed">
                                We sent a recovery link to <br />
                                <strong className="text-text-main font-semibold">{email}</strong>
                            </p>
                        </Reveal>

                        <Reveal width="100%" delay={0.3}>
                            <div className="space-y-6">
                                <p className="text-sm text-text-secondary/80 mb-6 bg-background py-3 px-4 rounded-lg border border-border">
                                    Please click the link in the sent email to recover your account and reset the password.
                                </p>

                                <button
                                    onClick={handleClose}
                                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20"
                                >
                                    Close
                                </button>
                            </div>
                        </Reveal>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}