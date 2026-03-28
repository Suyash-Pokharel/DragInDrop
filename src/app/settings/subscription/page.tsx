import React from "react";
import { CreditCard, Zap, CheckCircle2, AlertTriangle } from "lucide-react";

export default function SubscriptionPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Subscription</h2>
        <p className="text-text-secondary text-sm md:text-base">Manage your billing plan, payment methods, and invoices.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-sm">
        
        {/* Current Plan */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium text-text-main">Current Plan</h3>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full uppercase tracking-wider">Active</span>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-surface-highlight border border-border rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-2">
            <div className="flex flex-col gap-1">
              <h4 className="text-2xl font-bold text-text-main flex items-center gap-2">
                Pro Tier <Zap className="w-5 h-5 text-secondary fill-secondary" />
              </h4>
              <p className="text-sm text-text-secondary">Billed $19.99 monthly. Next charge on Nov 25, 2026.</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="flex items-center gap-1 text-xs text-text-main"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> 5 Social Accounts</span>
                <span className="flex items-center gap-1 text-xs text-text-main"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Unlimited Posts</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button className="px-6 py-2.5 bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition-colors shadow-sm w-full md:w-auto">
                Change Plan
              </button>
              <button className="px-6 py-2.5 border border-border hover:bg-error/10 hover:text-error hover:border-error/30 text-text-main text-sm font-medium rounded-lg transition-colors w-full md:w-auto">
                Cancel Subscription
              </button>
            </div>
          </div>
        </section>

        {/* Payment Method */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <h3 className="text-lg font-medium text-text-main">Payment Method</h3>
          </div>
          <div className="flex items-center justify-between bg-background border border-border p-4 rounded-xl mt-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-surface-highlight border border-border rounded-md flex items-center justify-center text-xs font-bold font-mono">
                VISA
              </div>
              <div>
                <h4 className="text-sm font-medium text-text-main">Visa ending in 4242</h4>
                <p className="text-xs text-text-secondary mt-0.5">Expires 12/28</p>
              </div>
            </div>
            <button className="text-sm text-primary hover:text-secondary font-medium transition-colors">
              Update
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
