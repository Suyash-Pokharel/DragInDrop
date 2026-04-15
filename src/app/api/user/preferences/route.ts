import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

/**
 * Zod schema for preferences validation
 * Requirements: 9.5, 7.1
 */
const preferencesSchema = z.object({
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"], {
    message: "Invalid date format",
  }),
  timeFormat: z.enum(["12h", "24h"], {
    message: "Invalid time format",
  }),
  firstDayOfWeek: z.enum(["sunday", "monday"], {
    message: "Invalid first day of week",
  }),
  timezone: z
    .string({ message: "Timezone is required" })
    .min(1, "Timezone is required"),
});

/**
 * Validates if a timezone is a valid IANA identifier
 * Requirements: 9.5
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/user/preferences
 * Retrieves the authenticated user's preferences or returns default values if none exist
 * Requirements: 9.1, 9.3, 6.1
 */
export async function GET() {
  try {
    // Authenticate user
    const user = await ensureAuth();
    if (user instanceof NextResponse) {
      return user;
    }

    // Query UserPreferences by userId
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
    if (!preferences) {
      return NextResponse.json({
        dateFormat: "DD/MM/YYYY",
        timeFormat: "12h",
        firstDayOfWeek: "sunday",
        timezone: null, // Explicitly null to trigger auto-detection
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("[GET /api/user/preferences] Error fetching preferences:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/preferences
 * Creates or updates the authenticated user's preferences
 * Requirements: 9.2, 9.4, 9.5, 7.1, 7.3, 7.5
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await ensureAuth();
    if (user instanceof NextResponse) {
      return user;
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = preferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { dateFormat, timeFormat, firstDayOfWeek, timezone } =
      validationResult.data;

    // Validate timezone is a valid IANA identifier
    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        {
          error: "Invalid timezone",
          details: "Timezone must be a valid IANA timezone identifier",
        },
        { status: 400 }
      );
    }

    // Upsert UserPreferences record
    const prisma = getPrisma();
    await prisma.userPreferences.upsert({
      where: {
        userId: user.id,
      },
      update: {
        dateFormat,
        timeFormat,
        firstDayOfWeek,
        timezone,
      },
      create: {
        userId: user.id,
        dateFormat,
        timeFormat,
        firstDayOfWeek,
        timezone,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Preferences saved successfully",
    });
  } catch (error) {
    console.error("[POST /api/user/preferences] Error saving preferences:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
