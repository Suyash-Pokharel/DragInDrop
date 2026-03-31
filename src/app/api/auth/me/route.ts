import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile (without sensitive fields).
 * Used by the client-side UserProvider to populate session state.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await getCurrentUserFromToken(token);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[auth/me] Error:", err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
