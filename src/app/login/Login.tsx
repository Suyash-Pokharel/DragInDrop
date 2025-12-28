"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import ForgetPassword from "./ForgotPassword";
import GoogleLogo from "../assets/logo/Google.webp";
// 1. Import Reveal
import { Reveal } from "../components/Reveal";

export default function Login() {
    // Login State
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Unified State (formData)
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const [touched, setTouched] = useState({ email: false, password: false });

    // Helper checks
    const isEmailError = touched.email && formData.email.trim() === "";
    const isPasswordError = touched.password && formData.password.trim() === "";

    // --- FORM VALIDITY CHECK ---
    const isFormValid = formData.email.trim() !== "" && formData.password.trim() !== "";

    // Modal State
    const [showForgetPassword, setShowForgetPassword] = useState(false);

    // Reusable Handlers
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleBlur = (field: keyof typeof touched) => {
        setTouched({ ...touched, [field]: true });
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate Login API call
        setTimeout(() => {
            setIsLoading(false);
            console.log("Logged in with:", formData.email);
        }, 1500);
    };

    return (
        // Removed generic 'animate-in' class to let Reveal handle it
        <Reveal width="100%" delay={0.05}>
        <div className="w-full flex justify-center p-4">
            {/* --- LOGIN CARD --- */}
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                
                {/* 2. Reveal Header */}
                <Reveal width="100%" delay={0.1}>
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-primary mb-2">DragInDrop</h1>
                        <h2 className="text-text-secondary text-sm font-medium">
                            Login to your account
                        </h2>
                    </div>
                </Reveal>

                {/* 3. Reveal Form with delay */}
                <Reveal width="100%" delay={0.15}>
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="loginEmail"
                                className="block text-sm font-medium text-text-main"
                            >
                                Email
                                {/* Added: Error Text */}
                                {isEmailError && (
                                    <span className="inline-error">
                                        REQUIRED
                                    </span>
                                )}
                            </label>
                            <input
                                id="loginEmail"
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

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="loginPassword"
                                className="block text-sm font-medium text-text-main"
                            >
                                Password
                                {/* Added: Error Text */}
                                {isPasswordError && (
                                    <span className="inline-error">
                                        REQUIRED
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    id="loginPassword"
                                    name="password"
                                    autoComplete="current-password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    disabled={isLoading}
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    onBlur={() => handleBlur("password")}
                                    className={`input-base ${isPasswordError ? "input-error" : "input-default"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors p-1"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForgetPassword(true)}
                                className="text-sm text-primary font-medium hover:text-secondary transition-colors hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !isFormValid}
                            className="w-full py-3 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-secondary active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                "Login"
                            )}
                        </button>

                        {/* Register Link */}
                        <div className="text-center text-sm text-text-secondary">
                            Don&apos;t have an account?{" "}
                            <Link
                                href="/register"
                                className="text-primary font-semibold hover:text-secondary hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Register
                            </Link>
                        </div>
                    </form>
                </Reveal>

                {/* 4. Reveal Footer (Separator & Google) with more delay */}
                <Reveal width="100%" delay={0.2}>
                    <div>
                        {/* Separator */}
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
                    </div>
                </Reveal>
            </div>

            {/* --- FORGOT PASSWORD MODAL COMPONENT --- */}
            {showForgetPassword && (
                <ForgetPassword onClose={() => setShowForgetPassword(false)} />
            )}
        </div>
        </Reveal>
    );
}