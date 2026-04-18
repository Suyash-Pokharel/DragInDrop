"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SlidersHorizontal, Globe2, Clock, CalendarDays, AlertCircle } from "lucide-react";

interface PreferencesState {
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
  firstDayOfWeek: "sunday" | "monday";
  timezone: string;
}

interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

interface PreferencesProps {
  initialPreferences: PreferencesState;
}

/**
 * Client component for Preferences page.
 * Handles interactive features: form inputs, timezone detection, save functionality.
 * Receives user preferences data as props from parent Server Component.
 *
 * @param initialPreferences - User preferences fetched server-side from database
 */
export default function Preferences({ initialPreferences }: PreferencesProps) {
  const [preferences, setPreferences] = useState<PreferencesState>(initialPreferences);

  // Track original preferences for change detection
  const [originalPreferences, setOriginalPreferences] = useState<PreferencesState>(initialPreferences);

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Get UTC offset for a timezone
   * Returns format like "UTC+5:30" or "UTC-8:00"
   */
  const getUTCOffset = (timezone: string): string => {
    try {
      const now = new Date();
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return 'UTC';
    }
  };

  /**
   * Generate timezone options with UTC offsets
   * Memoized to avoid recalculating on every render
   */
  const timezoneOptions = useMemo<TimezoneOption[]>(() => {
    try {
      const timezones = Intl.supportedValuesOf('timeZone');
      return timezones.map(tz => ({
        value: tz,
        label: tz,
        offset: getUTCOffset(tz)
      }));
    } catch {
      // Fallback if Intl.supportedValuesOf is not available
      return [];
    }
  }, []);

  /**
   * Auto-save detected timezone to database
   * This runs automatically when timezone is detected for first-time users
   */
  const autoSaveDetectedTimezone = useCallback(async (detectedTimezone: string) => {
    try {
      // Create preferences object with detected timezone and current defaults
      const autoSavePreferences = {
        dateFormat: originalPreferences.dateFormat,
        timeFormat: originalPreferences.timeFormat,
        firstDayOfWeek: originalPreferences.firstDayOfWeek,
        timezone: detectedTimezone
      };

      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(autoSavePreferences),
      });

      if (response.ok) {
        // Update original preferences to reflect what's now saved in database
        setOriginalPreferences(autoSavePreferences);
        setHasUnsavedChanges(false);
        
        // Show a subtle success message for auto-save
        setSuccessMessage("Timezone auto-detected and saved");
        setTimeout(() => {
          setSuccessMessage(null);
        }, 2000);
        
        console.log('Auto-saved detected timezone:', detectedTimezone);
      } else {
        console.error('Failed to auto-save detected timezone');
      }
    } catch (error) {
      console.error('Error auto-saving detected timezone:', error);
    }
  }, [originalPreferences]);

  /**
   * Auto-detect and save user's timezone on first load (when no timezone is saved)
   */
  useEffect(() => {
    // Only auto-detect if timezone is empty
    if (!originalPreferences.timezone) {
      try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTimezone) {
          // Update UI state immediately
          setPreferences(prev => ({ ...prev, timezone: detectedTimezone }));
          
          // Auto-save the detected timezone to database
          autoSaveDetectedTimezone(detectedTimezone);
        }
      } catch (error) {
        console.error('Failed to detect timezone:', error);
      }
    }
  }, [originalPreferences.timezone, autoSaveDetectedTimezone]);

  // Detect changes by comparing current preferences with original
  useEffect(() => {
    const hasChanges =
      preferences.dateFormat !== originalPreferences.dateFormat ||
      preferences.timeFormat !== originalPreferences.timeFormat ||
      preferences.firstDayOfWeek !== originalPreferences.firstDayOfWeek ||
      preferences.timezone !== originalPreferences.timezone;

    setHasUnsavedChanges(hasChanges);
  }, [preferences, originalPreferences]);

  /**
   * Handle field changes and update state
   * Requirements: 8.2, 1.3, 2.4, 3.4, 4.3
   */
  const handleFieldChange = (field: keyof PreferencesState, value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Handle save preferences with timezone validation
   * Requirements: 7.1, 7.2
   */
  const handleSave = async () => {
    // Clear previous messages
    setError(null);
    setSuccessMessage(null);

    // Validate that timezone is selected
    if (!preferences.timezone) {
      setError("Please select a timezone before saving");
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save preferences");
      }

      // Success: update original preferences and show success message
      setOriginalPreferences(preferences);
      setHasUnsavedChanges(false);
      setSuccessMessage("Preferences saved successfully");

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError(err instanceof Error ? err.message : "Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Preferences</h2>
        <p className="text-text-secondary text-sm md:text-base">
          Customize formatting and regional settings to your liking.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

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
                  <select
                    value={preferences.dateFormat}
                    onChange={(e) => handleFieldChange("dateFormat", e.target.value as PreferencesState["dateFormat"])}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2000)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2000)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2000-12-31)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-main flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    Time Format
                  </label>
                  <select
                    value={preferences.timeFormat}
                    onChange={(e) => handleFieldChange("timeFormat", e.target.value as PreferencesState["timeFormat"])}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    <option value="12h">12-hour (06:00 PM)</option>
                    <option value="24h">24-hour (18:00)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-text-main flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
                    First Day of the Week
                  </label>
                  <select
                    value={preferences.firstDayOfWeek}
                    onChange={(e) => handleFieldChange("firstDayOfWeek", e.target.value as PreferencesState["firstDayOfWeek"])}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
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
              <p className="text-sm text-text-secondary">
                Your timezone dictates when your scheduled videos will be published.
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm font-medium text-text-main">Timezone</label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => handleFieldChange("timezone", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select your timezone</option>
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
                {preferences.timezone && (
                  <p className="text-xs text-text-secondary mt-1">
                    Current time in {preferences.timezone}: {new Date().toLocaleString('en-US', { 
                      timeZone: preferences.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: preferences.timeFormat === '12h'
                    })}
                  </p>
                )}
              </div>
            </section>

            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Unsaved Changes Indicator */}
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Unsaved changes</span>
                </div>
              )}
              
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary hover:bg-secondary text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 sm:ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {isSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
      </div>
    </div>
  );
}
