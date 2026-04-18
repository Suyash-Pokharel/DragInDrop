import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Subscription from "./Subscription";

/**
 * Server component for Subscription page.
 * Verifies authentication and redirects to login if user is not authenticated.
 */
export default async function SubscriptionPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <Subscription />;
}
