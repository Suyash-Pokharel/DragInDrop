import { NextResponse } from "next/server";
import {
  extractSessionFromCookieHeader,
  getCurrentUserFromToken,
} from "./getCurrentUser";

/** Ensure the request belongs to an admin; returns the user or NextResponse.json 401/403 */
export async function ensureAdmin(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") ?? "";

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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
