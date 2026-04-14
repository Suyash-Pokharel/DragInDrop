import { SlidersHorizontal, Globe2, Clock, CalendarDays } from "lucide-react";

export default function PreferencesPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Preferences</h2>
        <p className="text-text-secondary text-sm md:text-base">
          Customize formatting and regional settings to your liking.
        </p>
      </div>

      <div className="bg-surface/60 backdrop-blur-xl border border-border/60 rounded-[2rem] p-6 md:p-10 flex flex-col gap-8 shadow-lg">
        {/* Date & Time */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Date & Time Formats</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-main flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-text-secondary" />
                Date Format
              </label>
              <select className="w-full bg-surface/40 backdrop-blur-md border border-border/60 rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer shadow-sm">
                <option value="MM/DD/YYYY">MM/DD/YYYY (10/25/2026)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (25/10/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-25)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-main flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-secondary" />
                Time Format
              </label>
              <select className="w-full bg-surface/40 backdrop-blur-md border border-border/60 rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer shadow-sm">
                <option value="12h">12-hour (02:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium text-text-main flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
                First Day of the Week
              </label>
              <select className="w-full bg-surface/40 backdrop-blur-md border border-border/60 rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer shadow-sm">
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
                <option value="saturday">Saturday</option>
              </select>
            </div>
          </div>
        </section>

        {/* Region */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Globe2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Region</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Your country/region dictates the timezone in which your scheduled videos will be
            published.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium text-text-main">Country / Region</label>
            <select className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
              <option value="US">United States (EST/PST)</option>
              <option value="UK">United Kingdom (GMT)</option>
              <option value="IN">India (IST)</option>
              <option value="NP">Nepal (NPT)</option>
              <option value="AU">Australia (AEST)</option>
            </select>
          </div>
        </section>

        <div className="mt-2 flex justify-end">
          <button className="px-6 py-2.5 bg-primary hover:bg-secondary text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
