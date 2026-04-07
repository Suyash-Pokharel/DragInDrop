import { NextResponse } from "next/server";
import { getCurrentUser } from "./getCurrentUser";

/** Ensure the request belongs to an admin; returns the user or NextResponse.json 401/403 */
export async function ensureAdmin(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return user;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

