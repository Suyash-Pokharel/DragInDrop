import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySignedToken } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";

/**
 * DELETE /api/social-accounts/disconnect/[platform]
 *
 * Removes the stored OAuth connection for the current user + given platform.
 * The user's tokens are permanently deleted from the database.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  // Validate session
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifySignedToken(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.sub;

  try {
    const prisma = getPrisma();

    const account = await prisma.socialAccount.findUnique({
      where: { userId_platform: { userId, platform } },
    });

    if (!account) {
      return NextResponse.json(
        { error: "No connected account found for this platform." },
        { status: 404 },
      );
    }

    await prisma.socialAccount.delete({
      where: { userId_platform: { userId, platform } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[social-accounts/disconnect/${platform}] Error:`, err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
