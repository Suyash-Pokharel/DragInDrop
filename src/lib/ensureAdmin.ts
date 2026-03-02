import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  extractSessionFromCookieHeader,
  getCurrentUserFromToken,
} from "./getCurrentUser";

/** Ensure the request belongs to an admin; returns the user or NextResponse.redirect/403 */
export async function ensureAdmin(req: Request | NextRequest) {
  try {
    const cookieHeader = (req as any).headers?.get
      ? (req as any).headers.get("cookie") || ""
      : typeof window === "undefined"
        ? undefined
        : undefined;

    // If running in Node API route, Request.headers.get is available; handle both
    const token = cookieHeader
      ? extractSessionFromCookieHeader(cookieHeader)
      : undefined;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUserFromToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return user;
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
