import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Dashboard from "./Dashboard";

/**
 * Server component for Dashboard page.
 * Verifies authentication and redirects to login if user is not authenticated.
 * Delegates to Dashboard client component for data fetching and rendering.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <Dashboard />;
}
