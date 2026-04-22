import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { ensureAuth } from "@/lib/ensureAuth";
import { getPrisma } from "@/lib/prisma";

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

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const user = await ensureAuth();
    if (user instanceof NextResponse) {
      return user;
    }

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

    if (!preferences) {
      return NextResponse.json({
        dateFormat: "DD/MM/YYYY",
        timeFormat: "12h",
        firstDayOfWeek: "sunday",
        timezone: null,
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

export async function POST(request: NextRequest) {
  try {
    const user = await ensureAuth();
    if (user instanceof NextResponse) {
      return user;
    }

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

    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        {
          error: "Invalid timezone",
          details: "Timezone must be a valid IANA timezone identifier",
        },
        { status: 400 }
      );
    }

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
        id: crypto.randomUUID(),
        userId: user.id,
        dateFormat,
        timeFormat,
        firstDayOfWeek,
        timezone,
        createdAt: new Date(),
        updatedAt: new Date(),
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
