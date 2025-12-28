"use client";

import React, { useState } from "react";
import { ChevronDown, CheckCircle, Loader2 } from "lucide-react";
// 1. Import the Reveal component
import { Reveal } from "../components/Reveal";

const WORD_LIMIT = 200;

export default function ContactUs() {
    // --- STATE ---
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        reason: "",
        message: "",
    });

    const [touched, setTouched] = useState({
        firstName: false,
        lastName: false,
        email: false,
        reason: false,
        message: false,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // --- VALIDATION LOGIC ---

    // 1. Basic Fields
    const isFirstNameError = touched.firstName && formData.firstName.trim() === "";
    const isLastNameError = touched.lastName && formData.lastName.trim() === "";
    const isEmailError = touched.email && formData.email.trim() === "";
    const isReasonError = touched.reason && formData.reason === "";

    // 2. Message & Word Count Logic
    const words = formData.message.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const isOverLimit = wordCount > WORD_LIMIT;

    // Message is error if empty OR if over limit
    const isMessageError = touched.message && (formData.message.trim() === "" || isOverLimit);

    // 3. Form Validity (Button Enable/Disable)
    const isFormValid =
        formData.firstName.trim() !== "" &&
        formData.lastName.trim() !== "" &&
        formData.email.trim() !== "" &&
        formData.reason !== "" &&
        formData.message.trim() !== "" &&
        !isOverLimit;

    // --- HANDLERS ---
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleBlur = (field: keyof typeof touched) => {
        setTouched({ ...touched, [field]: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormValid) {
            setTouched({
                firstName: true,
                lastName: true,
                email: true,
                reason: true,
                message: true,
            });
            return;
        }

        setIsLoading(true);

        // Simulate API Call
        setTimeout(() => {
            setIsLoading(false);
            setIsSuccess(true);
            setFormData({
                firstName: "",
                lastName: "",
                email: "",
                reason: "",
                message: "",
            });
            setTouched({
                firstName: false,
                lastName: false,
                email: false,
                reason: false,
                message: false,
            });
        }, 2000);
    };

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-20 items-start">

                {/* --- LEFT COLUMN: INFO --- */}
                <div className="w-full max-w-sm md:min-w-sm md:max-w-lg mx-auto lg:mx-0 text-center lg:text-left flex flex-col justify-center h-full p-4 lg:pt-0">
                    
                    {/* 2. Reveal Title */}
                    <Reveal>
                        <h1 className="text-5xl sm:text-6xl font-bold text-primary mb-6 tracking-tight">
                            Contact Us
                        </h1>
                    </Reveal>

                    {/* 3. Reveal Text with Delay */}
                    <Reveal delay={0.1}>
                        <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
                            Got a question about DragInDrop? Whether it&apos;s troubleshooting, feature
                            requests or general feedback, we&apos;re here to help. Drop us a line and
                            we&apos;ll respond as soon as possible.
                        </p>
                    </Reveal>
                </div>

                {/* --- RIGHT COLUMN: FORM --- */}
                {/* 4. Reveal the Form Card with more Delay */}
                <Reveal width="100%" delay={0.2}>
                    <div className="w-full max-w-sm md:min-w-sm md:max-w-lg mx-auto lg:mx-0 bg-surface border border-border rounded-2xl shadow-lg p-6 md:p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                        {isSuccess ? (
                            // Success State
                            <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6 text-success">
                                    <CheckCircle size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-text-main mb-2">
                                    Message Sent!
                                </h2>
                                <p className="text-text-secondary">
                                    Thank you for reaching out. We&apos;ll get back to you shortly.
                                </p>
                                <button
                                    onClick={() => setIsSuccess(false)}
                                    className="mt-8 text-primary font-semibold hover:underline cursor-pointer"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            // Form State
                            <form onSubmit={handleSubmit} className="space-y-6">

                                {/* Row: Names */}
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="space-y-1.5 w-full">
                                        <label htmlFor="firstName" className="block text-sm font-medium text-text-main">
                                            First Name
                                            {isFirstNameError && <span className="inline-error">REQUIRED</span>}
                                        </label>
                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            placeholder="John"
                                            disabled={isLoading}
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            onBlur={() => handleBlur("firstName")}
                                            className={`input-base ${isFirstNameError ? "input-error" : "input-default"}`}
                                        />
                                    </div>

                                    <div className="space-y-1.5 w-full">
                                        <label htmlFor="lastName" className="block text-sm font-medium text-text-main">
                                            Last Name
                                            {isLastNameError && <span className="inline-error">REQUIRED</span>}
                                        </label>
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            placeholder="Doe"
                                            disabled={isLoading}
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            onBlur={() => handleBlur("lastName")}
                                            className={`input-base ${isLastNameError ? "input-error" : "input-default"}`}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label htmlFor="contactEmail" className="block text-sm font-medium text-text-main">
                                        Your Email
                                        {isEmailError && <span className="inline-error">REQUIRED</span>}
                                    </label>
                                    <input
                                        id="contactEmail"
                                        name="email"
                                        type="email"
                                        placeholder="example@gmail.com"
                                        disabled={isLoading}
                                        value={formData.email}
                                        onChange={handleChange}
                                        onBlur={() => handleBlur("email")}
                                        className={`input-base ${isEmailError ? "input-error" : "input-default"}`}
                                    />
                                </div>

                                {/* Reason Dropdown */}
                                <div className="space-y-1.5">
                                    <label htmlFor="contactReason" className="block text-sm font-medium text-text-main">
                                        Reason for contacting us:
                                        {isReasonError && <span className="inline-error">REQUIRED</span>}
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="contactReason"
                                            name="reason"
                                            disabled={isLoading}
                                            value={formData.reason}
                                            onChange={handleChange}
                                            onBlur={() => handleBlur("reason")}
                                            className={`input-base appearance-none cursor-pointer ${isReasonError ? "input-error" : "input-default"
                                                } ${formData.reason === "" ? "text-text-secondary/60" : "text-text-main"}`}
                                        >
                                            <option value="" disabled>Please select a reason...</option>
                                            <option value="technical-support">Technical Support</option>
                                            <option value="billing-issue">Billing Issue</option>
                                            <option value="feature-request">Feature Request</option>
                                            <option value="general-feedback">General Feedback</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <ChevronDown
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                                            size={20}
                                        />
                                    </div>
                                </div>

                                {/* Message Textarea */}
                                <div className="space-y-1.5">
                                    <label htmlFor="contactMessage" className="block text-sm font-medium text-text-main">
                                        Please explain what you want to tell us:
                                        {touched.message && formData.message.trim() === "" && (
                                            <span className="inline-error">REQUIRED</span>
                                        )}
                                        {isOverLimit && (
                                            <span className="inline-error">WORD LIMIT EXCEEDED</span>
                                        )}
                                    </label>
                                    <textarea
                                        id="contactMessage"
                                        name="message"
                                        rows={6}
                                        placeholder="Your message here..."
                                        disabled={isLoading}
                                        value={formData.message}
                                        onChange={handleChange}
                                        onBlur={() => handleBlur("message")}
                                        className={`input-base resize-none ${isMessageError ? "input-error" : "input-default"
                                            }`}
                                    />

                                    {/* Word Counter */}
                                    <div className={`text-xs text-right transition-colors duration-200 ${isOverLimit ? "text-error font-bold" : "text-text-secondary"
                                        }`}>
                                        {isOverLimit
                                            ? `${wordCount - WORD_LIMIT} words over limit`
                                            : `${WORD_LIMIT - wordCount} words remaining`
                                        }
                                    </div>
                                </div>

                                {/* Submit Button */}
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
                                        "Send Message"
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </Reveal>
            </div>
        </div>
    );
}