"use client";

import { useState } from "react";
import { Gift, Copy, Check, Info } from "lucide-react";

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const referralLink = "https://dragindrop.com/ref/suyash_p12";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Referrals & Rewards</h2>
        <p className="text-text-secondary text-sm md:text-base">
          Invite friends and earn rewards based on their subscription plan.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-sm">
        {/* Your Referral Link */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Your Referral Link</h3>
          </div>

          <div className="bg-background border border-border p-5 rounded-xl mt-2">
            <p className="text-sm text-text-main mb-3">
              Share this link with your network. When they sign up and subscribe, you get account
              credits!
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-surface-highlight border border-border rounded-lg px-4 py-3 text-sm font-mono text-text-main focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-5 py-3 bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </section>

        {/* Apply Referral */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <h3 className="text-lg font-medium text-text-main">Apply a Referral Code</h3>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-text-secondary">
              Did someone invite you? Enter their code here to give them credit.
            </p>
            <div className="flex items-start gap-2 max-w-md">
              <input
                type="text"
                placeholder="Enter referral code"
                className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors uppercase"
              />
              <button className="px-5 py-2.5 border border-border hover:bg-surface-highlight hover:border-text-secondary text-text-main text-sm font-medium rounded-lg transition-colors">
                Apply Code
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-text-secondary/70">
              <Info className="w-3.5 h-3.5" />
              <span>You cannot apply a code if you have already applied one.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
