import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <Dashboard />;
}
