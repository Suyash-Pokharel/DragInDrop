"use client";

import React, { useState } from "react";
import { SlidersHorizontal, Globe2, Clock, CalendarDays } from "lucide-react";
import { TimezoneOption } from "@/utils/timezones";

interface PreferencesClientProps {
  timezonesList: TimezoneOption[];
  initialTimezone: string;
}

export default function PreferencesClient({ timezonesList, initialTimezone }: PreferencesClientProps) {
  const [selectedTimezone, setSelectedTimezone] = useState<string>(initialTimezone);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Preferences</h2>
        <p className="text-text-secondary text-sm md:text-base">Customize formatting and regional settings to your liking.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-sm">
        
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
              <select className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
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
              <select className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
                <option value="12h">12-hour (02:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium text-text-main flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
                First Day of the Week
              </label>
              <select className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
            </div>
          </div>
        </section>

        {/* Timezone */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Globe2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Timezone</h3>
          </div>
          <p className="text-sm text-text-secondary">Your timezone dictates when your scheduled videos will be published.</p>
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium text-text-main">Timezone</label>
            <select 
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
            >
              {timezonesList.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="mt-2 flex justify-end">
          <button className="px-5 py-2 bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
            Save Preferences
          </button>
        </div>

      </div>
    </div>
  );
}
