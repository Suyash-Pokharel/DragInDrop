import { getPrisma } from "@/lib/prisma";
import { verifySignedToken } from "./session";

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  profilePic?: string | null;
  emailVerified?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Given a signed session token, return the user from the database (without password).
 */
export async function getCurrentUserFromToken(
  token?: string,
): Promise<PublicUser | null> {
  if (!token) return null;

  const payload = verifySignedToken(token);
  if (!payload || !payload.sub) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePic: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * Convenience wrapper: extract token from a cookie header string like 'session=...'
 */
export function extractSessionFromCookieHeader(
  cookieHeader?: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    if (p.startsWith("session=")) return p.substring("session=".length);
  }
  return undefined;
}
