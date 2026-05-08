import { Suspense } from "react";
import SelectFacebookPageClient from "./SelectFacebookPageClient";

/**
 * Server Component for Facebook Page Selection
 * This page is displayed after OAuth callback with available Pages data
 * Requirements: 5.1, 5.2, 5.3, 5.9
 */
export default function SelectFacebookPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 shadow-lg max-w-2xl w-full">
            <div className="animate-pulse">
              <div className="h-8 bg-surface-highlight rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-surface-highlight rounded w-full mb-8"></div>
              <div className="space-y-4">
                <div className="h-20 bg-surface-highlight rounded"></div>
                <div className="h-20 bg-surface-highlight rounded"></div>
              </div>
            </div>
          </div>
        }
      >
        <SelectFacebookPageClient />
      </Suspense>
    </div>
  );
}
