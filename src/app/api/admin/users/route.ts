import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ensureAdmin } from "@/lib/ensureAdmin";

export async function GET() {
  const adminCheck = await ensureAdmin();
  if (adminCheck instanceof NextResponse) return adminCheck;

  // At this point, adminCheck is the user
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      role: true,
      createdAt: true,
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
  });
  return NextResponse.json({ users });
}
