"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
// 1. Import the Reveal component
import { Reveal } from "../components/Reveal";

{
  /* --- FAQ Section --- */
}
const FAQS = [
  {
    question: "Can I change my plan later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes will be prorated and applied to your next billing cycle.",
  },
  {
    question: "Is there a Free Trial?",
    answer:
      "The Free tier acts as your trial, allowing you to explore the platform at no cost. Additionally, all paid plans come with a 7-day Money-Back Guarantee. If you're not satisfied with the service within that period, you can cancel for a full refund.",
  },
  {
    question: "What happens if I exceed my post limit on the Free plan?",
    answer:
      "On the Free plan, you can schedule up to 10 posts per month. If you reach this limit, you won't be able to schedule more posts until the next month begins. To continue scheduling, you can upgrade to our Starter or Pro plan for unlimited posts.",
  },
  {
    question: "What is Basic Analytics?",
    answer:
      "You get access to the restricted analytics (no AI Analysis) for videos uploaded within the last 1 month.",
  },
  {
    question: "What is Advanced Analytics?",
    answer:
      "You get access to the Full Analytics with AI Integration for all your uploaded videos, available for the entire duration of your subscription.",
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background text-text-main pt-10 pb-5 px-3 transition-colors duration-300 font-sans">
      <div className="max-w-[90%] mx-auto">
        
        {/* --- HEADER --- */}
        <div className="text-center max-w-3xl mx-auto mb-10 px-3">
          <Reveal width="100%" delay={0.05}>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-primary tracking-tight">
              Choose Your Plan
            </h1>
          </Reveal>
          <Reveal width="100%" delay={0.05}>
            <p className="text-lg md:text-xl text-text-secondary leading-relaxed">
              Join thousands of creators who trust DragInDrop to streamline their
              workflow. Start for free, then upgrade as you grow with a plan that
              fits your needs.
            </p>
          </Reveal>
        </div>

        {/* --- FREE PLAN BANNER --- */}
        <div className="flex justify-center mb-14">
          <Reveal width="100%" delay={0.1}>
            <div className="w-[296px] mx-auto bg-surface text-text-main border border-primary/50 rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:border hover:border-primary transform hover:-translate-y-2 transition-all duration-300 relative overflow-hidden flex flex-col h-full items-center">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">Free</h2>
                <p className="text-sm text-text-secondary">
                  Limited Free Tier of the starter pack for creators.
                </p>
              </div>

              <div className="text-center mb-8 flex items-baseline justify-center">
                <span className="text-4xl font-bold text-text-main">$0</span>
                <span className="text-text-secondary ms-2 font-medium">
                  / Forever
                </span>
              </div>

              <ul className="w-full space-y-4 flex-1 text-sm text-text-main mb-8">
                {[
                  "3 Connected Social Accounts",
                  "Youtube • TikTok • Instagram",
                  "Basic Video Analytics",
                  "9 Total Scheduled Posts / Month",
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
                href=""
                className="block w-full py-3 px-8 rounded-lg bg-background border border-border text-text-main font-semibold duration-400 hover:border-primary hover:bg-surface-highlight hover:-translate-y-1.5 active:-translate-y-0.5 hover:shadow-lg transition-transform text-center"
              >
                Get Started
              </Link>
            </div>
          </Reveal>
        </div>

        {/* --- TOGGLE SECTION --- */}
        <Reveal width="100%" delay={0.15}>
          <div className="text-center mb-16">
            <p className="text-sm text-text-secondary mb-6 max-w-xl mx-auto">
              All our Paid Plans are backed by a 7-Day Money-Back Guarantee.
              Simple, transparent pricing with no hidden fees.
            </p>

            <div className="relative inline-flex items-center justify-center gap-3 select-none">
              <span
                className={`text-md font-medium cursor-pointer transition-colors ${
                  !isAnnual ? "text-primary font-bold" : "text-text-secondary"
                }`}
                onClick={() => setIsAnnual(false)}
              >
                Monthly
              </span>

              <div
                className="relative w-14 h-7 bg-surface border border-primary rounded-full cursor-pointer transition-colors"
                onClick={() => setIsAnnual(!isAnnual)}
              >
                <div
                  className={`absolute top-[3px] w-5 h-5 bg-primary rounded-full shadow-md transition-all duration-300 ${
                    isAnnual ? "left-[30px]" : "left-1"
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
                className={`absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-bold text-success bg-success/10 px-2.5 py-0.5 rounded-full transition-all duration-300 ease-out ${
                  isAnnual
                    ? "opacity-100 translate-x-3"
                    : "opacity-0 -translate-x-2"
                }`}
              >
                Save ~25%
              </span>
            </div>
          </div>
        </Reveal>

        {/* --- PRICING GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 w-full gap-y-12 max-w-6xl mx-auto mb-18 justify-items-center items-start">
          
          {/* 1. STARTER PLAN (Delay 0.1s) */}
          <Reveal width="100%" delay={0.2}>
            <div className="w-[321px] mx-auto bg-surface text-text-main border border-surface rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:border-2 hover:border-primary transform hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden flex flex-col h-full items-center">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">Starter</h2>
                <p className="text-sm text-text-secondary h-8 ">
                  For individuals and creators just getting started.
                </p>
              </div>

              <div className="text-center mb-8 flex items-center justify-center">
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
                href=""
                className="block w-full py-3 px-8 rounded-lg bg-background border border-border text-text-main font-semibold hover:border-primary hover:bg-surface-highlight hover:-translate-y-1.5 active:-translate-y-0.5 hover:shadow-lg transition-transform duration-400 text-center"
              >
                Get Started
              </Link>
            </div>
          </Reveal>

          {/* 2. PRO PLAN (Delay 0.2s - Cascading Effect) */}
          <Reveal width="100%" delay={0.25}>
            <div className="w-[321px] mx-auto order-first lg:-order-1 xl:order-0 relative bg-surface text-text-main border-3 border-primary rounded-2xl p-8 shadow-glow transform md:-translate-y-4 hover:-translate-y-6 transition-transform duration-300 overflow-hidden flex flex-col h-full items-center z-10">
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

              <div className="text-center mb-10 h-12 flex items-center justify-center">
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
                href=""
                className="block w-full py-3 px-6 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-all duration-400 hover:-translate-y-1.5 active:-translate-y-0.5 text-center shadow-lg"
              >
                Start 14-Day Trial
              </Link>
            </div>
          </Reveal>

          {/* 3. BUSINESS PLAN (Delay 0.3s - Cascading Effect) */}
          <Reveal width="100%" delay={0.3}>
            <div className="w-[321px] mx-auto bg-surface text-text-main border border-surface rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:border-2 hover:border-primary transform hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden flex flex-col h-full items-center">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">Business</h2>
                <p className="text-sm text-text-secondary h-8">
                  For larger teams and agencies managing multiple brands.
                </p>
              </div>

              <div className="text-center mb-8 h-12 flex items-center justify-center">
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
                className="block w-full py-3 px-8 rounded-lg bg-background border border-border text-text-main font-semibold hover:border-primary hover:bg-surface-highlight hover:-translate-y-1.5 active:-translate-y-0.5 hover:shadow-lg transition-transform duration-400 text-center"
              >
                Contact Sales
              </Link>
            </div>
          </Reveal>
        </div>

        {/* --- FAQ SECTION --- */}
        <Reveal width="100%" delay={0.35}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-text-main">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index;

                return (
                  <div
                    key={index}
                    className={`border border-border rounded-lg overflow-hidden bg-surface transition-all duration-300 ${
                      isOpen ? "shadow-md ring-1 ring-border" : "shadow-sm"
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                      className={`
                w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none transition-colors group
                hover:bg-surface-highlight border-b
                ${
                  isOpen
                    ? "bg-surface-highlight border-border opacity-100"
                    : "border-transparent border-opacity-0"
                }
              `}
                    >
                      <span className="font-semibold text-sm md:text-base text-text-main">
                        {faq.question}
                      </span>

                      {isOpen ? (
                        <ChevronUp size={20} className="text-primary" />
                      ) : (
                        <ChevronDown
                          size={20}
                          className="text-text-secondary group-hover:text-primary transition-colors duration-200"
                        />
                      )}
                    </button>

                    <div
                      className={`px-6 text-sm text-text-secondary overflow-hidden transition-all duration-300 ease-in-out ${
                        isOpen ? "max-h-96 py-4" : "max-h-0 py-0"
                      }`}
                    >
                      <p className="leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}