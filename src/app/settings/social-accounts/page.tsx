import React from "react";
import { LayoutGrid } from "lucide-react";
import { APP_PLATFORMS } from "@/lib/platforms";
import { getConnectedPlatforms } from "@/app/actions/socialAccounts";
import SocialAccountsClient from "./SocialAccountsClient";

// Force dynamic rendering since we use cookies() in server actions
export const dynamic = 'force-dynamic';

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  // Fetch connected platforms on the server
  const result = await getConnectedPlatforms();
  const connectedPlatforms = result.success && result.platforms 
    ? result.platforms.map((p) => p.platform) 
    : [];

  // Determine message from URL params
  let message: { type: "success" | "error"; text: string } | null = null;
  if (searchParams.success === "google_connected") {
    message = { type: "success", text: "Google account connected successfully!" };
  } else if (searchParams.error === "oauth_denied") {
    message = { type: "error", text: "OAuth authorization was denied." };
  } else if (searchParams.error === "oauth_failed") {
    message = { type: "error", text: "Failed to connect account. Please try again." };
  } else if (searchParams.error === "not_authenticated") {
    message = { type: "error", text: "Please log in to connect social accounts." };
  }

  return (
    <SocialAccountsClient 
      initialConnectedPlatforms={connectedPlatforms}
      initialMessage={message}
      platforms={APP_PLATFORMS}
    />
  );
}
