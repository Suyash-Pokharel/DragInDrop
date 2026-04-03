import MonthCalendar from "./MonthCalendar";
import { getScheduledPosts } from "@/app/actions/scheduledPosts";

export default async function CalendarPage() {
  // Fetch scheduled posts on the server
  const result = await getScheduledPosts();
  const scheduledPosts = result.success && result.posts ? result.posts : [];

  return (
    <main className="min-h-screen bg-background text-text-main p-4 md:p-8 pt-24 transition-colors duration-300">
      <MonthCalendar initialPosts={scheduledPosts} />
    </main>
  );
}