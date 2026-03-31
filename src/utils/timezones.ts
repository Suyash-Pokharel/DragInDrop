export interface TimezoneOption {
  value: string;
  label: string;
  offset: number;
}

/**
 * Retrieves a sorted, formatted list of all IANA timezones supported by the environment.
 */
export function getTimezones(): TimezoneOption[] {
  // Get all supported standard IANA time zones
  const timeZones = Intl.supportedValuesOf("timeZone");
  const tempDate = new Date();

  const options = timeZones.map((timeZone) => {
    // Extract the timezone offset string (e.g., "GMT-4", "GMT+5:30", "GMT")
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });

    const parts = formatter.formatToParts(tempDate);
    const tzNamePart = parts.find((p) => p.type === "timeZoneName");
    const offsetString = tzNamePart ? tzNamePart.value : "GMT";

    let numericOffset = 0;
    let displayOffset = "GMT±00:00";

    if (offsetString === "GMT") {
      numericOffset = 0;
      displayOffset = "GMT±00:00";
    } else {
      // Parse strings like "GMT-4" or "GMT+05:30"
      const match = offsetString.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === "+" ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;

        numericOffset = sign * (hours * 60 + minutes);

        const paddedHours = hours.toString().padStart(2, "0");
        const paddedMinutes = match[3] ? match[3] : "00";
        displayOffset = `GMT${match[1]}${paddedHours}:${paddedMinutes}`;
      }
    }

    return {
      value: timeZone,
      label: `(${displayOffset}) ${timeZone.replace(/_/g, " ")}`,
      offset: numericOffset,
    };
  });

  // Sort logically from West to East (negative to positive offset), then alphabetically
  options.sort((a, b) => {
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }
    return a.label.localeCompare(b.label);
  });

  return options;
}

/**
 * Gets the current user's local timezone
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return "UTC";
  }
}
