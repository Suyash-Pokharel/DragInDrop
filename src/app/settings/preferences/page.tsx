import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";
import Preferences from "./Preferences";

/**
 * Server component for Preferences page.
 * Fetches user preferences server-side and passes to client component.
 * Redirects to login if user is not authenticated.
 */
export default async function PreferencesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user preferences from database
  const prisma = getPrisma();
  const preferences = await prisma.userPreferences.findUnique({
    where: {
      userId: user.id,
    },
    select: {
      dateFormat: true,
      timeFormat: true,
      firstDayOfWeek: true,
      timezone: true,
    },
  });

  // Return preferences or default values if no record exists
  const initialPreferences: {
    dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
    timeFormat: "12h" | "24h";
    firstDayOfWeek: "sunday" | "monday";
    timezone: string;
  } = preferences
    ? {
        dateFormat: preferences.dateFormat as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD",
        timeFormat: preferences.timeFormat as "12h" | "24h",
        firstDayOfWeek: preferences.firstDayOfWeek as "sunday" | "monday",
        timezone: preferences.timezone || "",
      }
    : {
        dateFormat: "DD/MM/YYYY",
        timeFormat: "12h",
        firstDayOfWeek: "sunday",
        timezone: "", // Empty string to trigger auto-detection
      };

  return <Preferences initialPreferences={initialPreferences} />;
}
