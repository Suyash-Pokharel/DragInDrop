import React from "react";
import { SlidersHorizontal, Globe2, Clock, CalendarDays } from "lucide-react";
import { getTimezones, getUserTimezone } from "@/utils/timezones";
import PreferencesClient from "./PreferencesClient";

export default function PreferencesPage() {
  // Get timezone data on the server
  const timezonesList = getTimezones();
  const userTimezone = getUserTimezone();
  const selectedTimezone = userTimezone || (timezonesList.length > 0 ? timezonesList[0].value : "");

  return (
    <PreferencesClient 
      timezonesList={timezonesList}
      initialTimezone={selectedTimezone}
    />
  );
}

