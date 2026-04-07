import { auth } from "@/auth";

export type PublicUser = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role?: string;
  image?: string | null;
};

/**
 * Returns the currently authenticated user from NextAuth.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  
  return session.user as PublicUser;
}

