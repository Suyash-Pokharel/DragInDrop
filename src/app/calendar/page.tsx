import MonthCalendar from "./MonthCalendar";

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-background text-text-main p-4 md:p-8 pt-24 transition-colors duration-300">
      <MonthCalendar />
    </main>
  );
}