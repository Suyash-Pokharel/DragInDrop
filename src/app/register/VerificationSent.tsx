"use client";

import React from "react";
import { X } from "lucide-react";

interface VerificationSentProps {
    email: string;
    onClose: () => void;
}

export default function VerificationSent({ email, onClose }: VerificationSentProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 md:p-8 relative border border-border animate-in zoom-in-95 duration-300 text-center">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full text-text-secondary hover:bg-surface-highlight hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-3xl font-bold text-text-main mb-2">Check your email</h2>
                <p className="text-text-secondary text-sm mb-6">
                    We sent a verification link to <br />
                    <strong className="text-text-main">{email}</strong>
                </p>

                <p className="text-sm text-text-secondary/80 mb-6 bg-background py-3 px-4 rounded-lg border border-border">
                    Please click the link in the sent email to set up your password and activate your account.
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Close
                </button>
            </div>
        </div>
    );
}