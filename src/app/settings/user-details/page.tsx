import { getCurrentUser } from "@/lib/getCurrentUser";
import { redirect } from "next/navigation";
import UserDetailsClient from "./UserDetailsClient";

/**
 * Server component for User Details page.
 * Fetches user data server-side and passes to client component.
 * Redirects to login if user is not authenticated.
 */
export default async function UserDetailsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <UserDetailsClient user={user} />;
}
