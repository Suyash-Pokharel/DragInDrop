import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and has ADMIN role
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const prisma = getPrisma();
  
  // Fetch users with their OAuth accounts
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      role: true,
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <AdminDashboard initialUsers={users} />;
}
