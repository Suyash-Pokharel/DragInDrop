import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";
import SocialAccounts from "./SocialAccounts";

/**
 * Server component for Social Accounts page.
 * Fetches connected platforms server-side and passes to client component.
 * Redirects to login if user is not authenticated.
 */
export default async function SocialAccountsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch connected platforms from database
  const prisma = getPrisma();
  const socialAccounts = await prisma.socialAccount.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      platform: true,
    },
  });

  const connectedPlatforms = socialAccounts.map((account) => account.platform);

  return <SocialAccounts initialConnectedPlatforms={connectedPlatforms} />;
}
