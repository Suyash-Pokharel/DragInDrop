"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MailCheck } from "lucide-react";
import { Reveal } from "../components/Reveal";

interface VerificationSentProps {
    email: string;
    onClose: () => void;
}

export default function VerificationSent({ email, onClose }: VerificationSentProps) {
    const [mounted, setMounted] = useState(false);

useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    // Lock scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
        clearTimeout(id);
        document.body.style.overflow = "unset";
    };
}, []);


    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Modal Container */}
            <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-8 relative border border-border">
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full text-text-secondary hover:bg-surface-highlight hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center">
                    {/* Icon with Reveal */}
                    <Reveal delay={0.1}>
                        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6 text-success">
                            <MailCheck size={32} strokeWidth={2.5} />
                        </div>
                    </Reveal>

                    {/* Text Content with Reveal */}
                    <Reveal delay={0.2} width="100%">
                        <h2 className="text-3xl font-bold text-text-main mb-3 tracking-tight">
                            Check your email
                        </h2>
                        <p className="text-text-secondary text-base mb-4 leading-relaxed">
                            We have sent a verification link to <br />
                            <strong className="text-text-main font-semibold">{email}</strong>
                        </p>
                    </Reveal>

                    {/* Action Area with Reveal */}
                    <Reveal delay={0.3} width="100%">
                        <div className="w-full space-y-6">
                        <p className="text-sm text-text-secondary/80 mb-6 bg-background py-3 px-4 rounded-lg border border-border">
                            Please click the link in the sent email to set up your password and activate your account.
                        </p>

                            <button
                                onClick={onClose}
                                className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20"
                            >
                                Close
                            </button>
                        </div>
                    </Reveal>
                </div>
            </div>
        </div>,
        document.body
    );
}