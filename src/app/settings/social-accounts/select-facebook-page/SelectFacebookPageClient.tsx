"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import FacebookLogo from "@/app/assets/logo/Facebook.webp";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  category?: string;
}

/**
 * Client Component for Facebook Page Selection
 * Displays available Pages and allows user to select one to connect
 * Requirements: 5.1, 5.2, 5.3, 5.9
 */
export default function SelectFacebookPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Parse Pages data from URL query parameter - computed during render
  const pagesParam = searchParams.get("pages");

  let pages: FacebookPage[] = [];
  let parseError: string | null = null;

  if (!pagesParam) {
    parseError = "No Pages data found. Please try connecting again.";
  } else {
    try {
      const decodedPages = JSON.parse(decodeURIComponent(pagesParam));

      if (!Array.isArray(decodedPages) || decodedPages.length === 0) {
        parseError =
          "No manageable Pages found. Please ensure you have ADMIN or EDITOR role with CREATE_CONTENT permission.";
      } else {
        // Requirement: 5.1 - Display list of Pages with id and name
        pages = decodedPages;
      }
    } catch (error) {
      console.error("Failed to parse Pages data:", error);
      parseError = "Failed to load Pages data. Please try connecting again.";
    }
  }

  const error = connectionError || parseError;

  // Handle Page selection
  const handleSelectPage = (pageId: string) => {
    // Requirement: 5.3 - Allow user to select one Page to connect at a time
    setSelectedPageId(pageId);
    setConnectionError(null);
  };

  // Handle Page connection
  const handleConnect = async () => {
    if (!selectedPageId) {
      setConnectionError("Please select a Page to connect.");
      return;
    }

    const selectedPage = pages.find((page) => page.id === selectedPageId);

    if (!selectedPage) {
      setConnectionError("Selected Page not found. Please try again.");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Requirement: 5.3 - Call /api/oauth/facebook-pages/select-page endpoint with selected Page data
      const response = await fetch("/api/oauth/facebook-pages/select-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          pageAccessToken: selectedPage.access_token,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Requirement: 5.9 - Handle success response and redirect to settings page
        setSuccess(true);

        // Redirect to settings page after a short delay
        setTimeout(() => {
          router.push("/settings/social-accounts?success=Facebook Page connected successfully");
        }, 1500);
      } else {
        // Requirement: 5.9 - Handle error responses and display error messages
        setConnectionError(data.error || "Failed to connect Page. Please try again.");
        setIsConnecting(false);
      }
    } catch (fetchError) {
      console.error("Failed to connect Page:", fetchError);
      // Requirement: 5.9 - Handle error responses and display error messages
      setConnectionError("Network error. Please check your connection and try again.");
      setIsConnecting(false);
    }
  };

  // Handle cancel action
  const handleCancel = () => {
    router.push("/settings/social-accounts");
  };

  // Show error state if no Pages data
  if (error && pages.length === 0) {
    return (
      <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 shadow-lg max-w-2xl w-full">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-text-main">Unable to Load Pages</h2>
          <p className="text-text-secondary">{error}</p>
          <button
            onClick={handleCancel}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 shadow-lg max-w-2xl w-full">
        <div className="flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="p-3 bg-green-500/10 rounded-full">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-text-main">Page Connected Successfully!</h2>
          <p className="text-text-secondary">Redirecting to settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 shadow-lg max-w-2xl w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Image
              src={FacebookLogo}
              alt="Facebook"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <h2 className="text-2xl font-semibold text-text-main">Select Facebook Page</h2>
        </div>
        <p className="text-text-secondary text-sm md:text-base">
          Choose which Facebook Page you want to connect to your account.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Pages List */}
      <div className="space-y-3 mb-6">
        {pages.map((page) => {
          const isSelected = selectedPageId === page.id;

          return (
            <button
              key={page.id}
              onClick={() => handleSelectPage(page.id)}
              disabled={isConnecting}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-surface/40 hover:border-primary/50 hover:bg-surface/60"
              } ${isConnecting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Image
                      src={FacebookLogo}
                      alt="Facebook"
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-main">{page.name}</h3>
                    <p className="text-xs text-text-secondary">
                      {page.category && `${page.category} • `}Page ID: {page.id}
                    </p>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCancel}
          disabled={isConnecting}
          className="flex-1 px-6 py-3 border border-border/60 hover:bg-surface-highlight hover:border-text-secondary text-text-main rounded-xl font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleConnect}
          disabled={!selectedPageId || isConnecting}
          className="flex-1 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <span>Connect Page</span>
          )}
        </button>
      </div>
    </div>
  );
}
