import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySignedToken } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";

/**
 * GET /api/social-accounts/list
 *
 * Returns the list of social accounts connected to the authenticated user.
 * Token values are never included in the response.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifySignedToken(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: payload.sub },
      select: {
        platform: true,
        platformUserId: true,
        platformUsername: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error("[social-accounts/list] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
