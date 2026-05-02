"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-surface border-t border-border pt-16 pb-8 font-sans">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          {/* Column 1: Brand & Description (Takes up more space) */}
          <div className="col-span-1 lg:col-span-4 flex flex-col">
            <Link
              href="/"
              className="font-bold text-2xl tracking-tight text-primary mb-6 inline-block"
            >
              DragInDrop
            </Link>
            <p className="text-text-secondary leading-relaxed max-w-sm">
              The simplest way to schedule, organize, and automate your video content across all
              your favorite social platforms from one unified dashboard.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="col-span-1 lg:col-span-2 flex flex-col">
            <h4 className="font-bold text-text-main mb-6 text-lg">Quick Links</h4>
            <div className="flex flex-col gap-4 text-text-secondary font-medium">
              <Link
                href="/"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Home
              </Link>
              <Link
                href="/pricing"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Pricing
              </Link>
              <Link
                href="/contactus"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Contact Us
              </Link>
              <Link
                href="/login"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Register
              </Link>
            </div>
          </div>

          {/* Column 3: Legal */}
          <div className="col-span-1 lg:col-span-2 flex flex-col">
            <h4 className="font-bold text-text-main mb-6 text-lg">Legal</h4>
            <div className="flex flex-col gap-4 text-text-secondary font-medium">
              <Link
                href="#"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Terms of Service
              </Link>
              <Link
                href="#"
                className="hover:text-primary transition-colors hover:translate-x-1 duration-300 w-fit"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Column 4: Newsletter / Stay Updated */}
          <div className="col-span-1 lg:col-span-4 flex flex-col">
            <h4 className="font-bold text-text-main mb-6 text-lg">Stay Updated</h4>
            <p className="text-text-secondary mb-6 leading-relaxed">
              Get the latest news, feature updates, and creator tips straight to your inbox.
            </p>
            <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email"
                className="input-base input-default w-full bg-background"
                required
              />
              <button
                type="submit"
                className="w-full py-3 px-4 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition-all duration-300 flex items-center justify-center gap-2 group shadow-sm hover:shadow-md active:-translate-y-0.5"
              >
                Subscribe
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-center md:justify-between items-center gap-4">
          <p className="text-sm font-medium text-text-secondary text-center">
            © {currentYear} DragInDrop. All Rights Reserved.
          </p>
          {/* Optional social icons could go here */}
          <div className="flex items-center gap-4 text-text-secondary">
            {/* Placeholders for future usage */}
          </div>
        </div>
      </div>
    </footer>
  );
}
