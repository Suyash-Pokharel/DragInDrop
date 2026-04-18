import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Notifications from "./Notifications";

/**
 * Server component for Notifications page.
 * Verifies authentication and redirects to login if user is not authenticated.
 */
export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <Notifications />;
}
