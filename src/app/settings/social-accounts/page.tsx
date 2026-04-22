import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPrisma } from "@/lib/prisma";
import SocialAccounts from "./SocialAccounts";

export default async function SocialAccountsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

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
