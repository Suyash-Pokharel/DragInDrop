import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPrisma } from "@/lib/prisma";

export type PublicUser = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
  image?: string | null;
  emailVerified?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Get the current user from NextAuth session.
 * Returns user data from database or null if no session exists.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}
