"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Reveal } from "../components/Reveal";

interface PricingPopupProps {
    onClose: () => void;
}

export default function PricingPopup({ onClose }: PricingPopupProps) {
    const [isAnnual, setIsAnnual] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    // 1. Handle Initial Mounting (Solves Hydration Mismatch)
    useEffect(() => {
        // Delay mounting slightly to satisfy strict ESLint rules
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // 2. Handle Animation & Scroll Lock (Runs ONLY after mounting)
    useEffect(() => {
        if (!mounted) return;

        // Trigger the "Open" animation frame
        requestAnimationFrame(() => {
            setShowModal(true);
        });

        // Lock the body scroll
        document.body.style.overflow = "hidden";

        // Cleanup: Unlock scroll when component unmounts
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mounted]);

    const handleClose = () => {
        // Trigger "Exit" animation
        setShowModal(false);
        // Wait for CSS transition (300ms) before unmounting
        setTimeout(onClose, 300);
    };

    // Don't render anything on the server
    if (!mounted) return null;

    // Render into the body (Portal)
    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
                showModal ? "opacity-100" : "opacity-0"
            }`}
        >
            {/* Modal Container */}
            <div
                className={`bg-background w-full max-w-6xl max-h-[87dvh] md:max-h-[90dvh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border border-border transition-all duration-300 ease-out transform ${
                    showModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
                }`}
            >
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-surface text-text-secondary hover:text-text-main hover:bg-surface-highlight transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto p-6 md:p-10 custom-scrollbar">
                    
                    {/* Header Section with Reveal */}
                    <Reveal width="100%" delay={0.05}>
                        <div className="text-center mb-10">
                            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
                                Upgrade Your Plan
                            </h2>

                            {/* --- TOGGLE SECTION --- */}
                            <div className="relative inline-flex items-center gap-2 md:gap-4 select-none">
                                <span
                                    className={`text-md font-medium cursor-pointer transition-colors ${
                                        !isAnnual ? "text-primary font-bold" : "text-text-secondary"
                                    }`}
                                    onClick={() => setIsAnnual(false)}
                                >
                                    Monthly
                                </span>

                                <div
                                    className="relative w-17 md:w-14 h-7 bg-surface border border-primary rounded-full cursor-pointer transition-colors"
                                    onClick={() => setIsAnnual(!isAnnual)}
                                >
                                    <div
                                        className={`absolute top-[3px] w-5 h-5 bg-primary rounded-full shadow-md transition-all duration-300 ${
                                            isAnnual ? "left-[27px] md:left-[31px]" : "left-1"
                                        }`}
                                    ></div>
                                </div>

                                <span
                                    className={`text-md font-medium cursor-pointer transition-colors ${
                                        isAnnual ? "text-primary font-bold" : "text-text-secondary"
                                    }`}
                                    onClick={() => setIsAnnual(true)}
                                >
                                    Annually
                                </span>

                                <span
                                    className={`md:absolute left-full top-1/2 md:-translate-y-1/2 md:whitespace-nowrap text-xs font-bold text-success bg-success/10 px-2.5 py-0.5 rounded-full transition-all duration-300 ease-out ${
                                        isAnnual
                                            ? "opacity-100 translate-x-1 md:translate-x-3"
                                            : "opacity-0 -translate-x-3"
                                    }`}
                                >
                                    Save ~25%
                                </span>
                            </div>
                        </div>
                    </Reveal>

                    {/* --- PRICING GRID with Reveal --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 w-full gap-y-12 gap-x-8 max-w-5xl mx-auto justify-items-center items-start pt-4 pb-8 px-2">

                        {/* 1. STARTER PLAN */}
                        <Reveal width="100%" delay={0.1}>
                            <div className="w-[300px] bg-surface text-text-main border border-surface rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:border-2 hover:border-primary transform hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden flex flex-col h-full items-center">
                                <div className="text-center mb-6">
                                    <h2 className="text-3xl font-bold mb-2">Starter</h2>
                                    <p className="text-sm text-text-secondary h-8 ">
                                        For individuals and creators just getting started.
                                    </p>
                                </div>

                                <div className="text-center mb-8 flex items-center justify-center h-14">
                                    <div
                                        key={isAnnual ? "annual" : "monthly"}
                                        className="flex items-baseline animate-price"
                                    >
                                        <span className="text-4xl font-bold transition-all duration-300">
                                            ${isAnnual ? "9" : "12"}
                                        </span>
                                        <span className="text-2xl font-bold">.99</span>
                                        <span className="text-text-secondary ms-1 text-sm font-medium">
                                            / month
                                        </span>
                                    </div>
                                </div>

                                <ul className="w-full space-y-4 flex-1 text-sm text-text-main mb-8">
                                    {[
                                        "3 Connected Social Accounts",
                                        "1 User per Account",
                                        "250 MB Video Size",
                                        "Unlimited Scheduled Posts",
                                        "Schedule Upto 1 Month in Advance",
                                        "Limited AI Integration",
                                        "Basic Upload Analytics",
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <Check
                                                size={18}
                                                className="text-success shrink-0 mt-0.5"
                                                strokeWidth={3}
                                            />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/payment"
                                    onClick={handleClose}
                                    className="block w-full py-3 px-8 rounded-lg bg-background border border-border text-text-main font-semibold hover:border-primary hover:bg-surface-highlight hover:-translate-y-1.5 active:-translate-y-0.5 hover:shadow-lg transition-transform duration-400 text-center"
                                >
                                    Get Started
                                </Link>
                            </div>
                        </Reveal>

                        {/* 2. PRO PLAN */}
                        <Reveal width="100%" delay={0.15}>
                            <div className="w-[300px] order-first lg:-order-1 xl:order-0 relative bg-surface text-text-main border-3 border-primary rounded-2xl p-8 shadow-glow transform md:-translate-y-4 hover:-translate-y-6 transition-transform duration-300 overflow-hidden flex flex-col h-full items-center z-10">
                                <div className="absolute top-0 right-0">
                                    <div className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg shadow-sm tracking-wide">
                                        MOST POPULAR
                                    </div>
                                </div>

                                <div className="text-center mb-6">
                                    <h2 className="text-5xl text-primary font-bold mb-3">Pro</h2>
                                    <p className="text-sm text-text-secondary">
                                        For professionals and small businesses scaling their content.
                                    </p>
                                </div>

                                <div className="text-center mb-10 h-14 flex items-center justify-center">
                                    <div
                                        key={isAnnual ? "annual" : "monthly"}
                                        className="flex items-baseline animate-price"
                                    >
                                        <span className="text-6xl font-bold text-primary transition-all duration-300">
                                            ${isAnnual ? "23" : "28"}
                                        </span>
                                        <span className="text-3xl font-bold text-primary">.99</span>
                                        <span className="text-text-secondary ms-1 text-md font-medium">
                                            / month
                                        </span>
                                    </div>
                                </div>

                                <ul className="w-full space-y-4 flex-1 text-sm text-text-main mb-10">
                                    {[
                                        "All 8 Supported Social Accounts",
                                        "2 User / Accounts",
                                        "500 MB Video Size",
                                        "Unlimited Scheduled Posts",
                                        "Schedule Upto 3 Month in Advance",
                                        "AI suggested Title, Description, Tags",
                                        "Advanced Upload Analytics",
                                        "Priority Email & Chat Support",
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <Check
                                                size={18}
                                                className="text-success shrink-0 mt-0.5"
                                                strokeWidth={3}
                                            />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/payment"
                                    onClick={handleClose}
                                    className="block w-full py-3 px-6 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-all duration-400 hover:-translate-y-1.5 active:-translate-y-0.5 text-center shadow-lg"
                                >
                                    Start 14-Day Trial
                                </Link>
                            </div>
                        </Reveal>

                        {/* 3. BUSINESS PLAN */}
                        <Reveal width="100%" delay={0.2}>
                            <div className="w-[300px] bg-surface text-text-main border border-surface rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:border-2 hover:border-primary transform hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden flex flex-col h-full items-center">
                                <div className="text-center mb-6">
                                    <h2 className="text-3xl font-bold mb-2">Business</h2>
                                    <p className="text-sm text-text-secondary h-8">
                                        For larger teams and agencies managing multiple brands.
                                    </p>
                                </div>

                                <div className="text-center mb-8 h-14 flex items-center justify-center">
                                    <span className="text-4xl font-bold">Custom</span>
                                </div>

                                <ul className="w-full space-y-4 flex-1 text-sm text-text-main mb-8">
                                    {[
                                        "All 8 Supported Social Accounts",
                                        "Team Collab (Unlimited Users)",
                                        "Unlimited Scheduled Posts",
                                        "AI Suggested Title, Description, Tags",
                                        "Advanced Upload Analytics",
                                        "AI Analyzed Analytics and Summary",
                                        "Email Notification on Every Upload",
                                        "Dedicated Account Manager",
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <Check
                                                size={18}
                                                className="text-success shrink-0 mt-0.5"
                                                strokeWidth={3}
                                            />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/contact"
                                    onClick={handleClose}
                                    className="block w-full py-3 px-8 rounded-lg bg-background border border-border text-text-main font-semibold hover:border-primary hover:bg-surface-highlight hover:-translate-y-1.5 active:-translate-y-0.5 hover:shadow-lg transition-transform duration-400 text-center"
                                >
                                    Contact Sales
                                </Link>
                            </div>
                        </Reveal>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}