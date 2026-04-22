import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const prisma = getPrisma();
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      role: true,
      Account: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
      SocialAccount: {
        select: {
          platform: true,
          platformAccountId: true,
          platformUsername: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <AdminDashboard initialUsers={users} />;
}
