import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Referral from "./Referral";

/**
 * Server component for Referral page.
 * Verifies authentication and redirects to login if user is not authenticated.
 */
export default async function ReferralPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <Referral />;
}
