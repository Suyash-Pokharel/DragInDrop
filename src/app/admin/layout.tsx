import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  // Redirect non-admin users to dashboard
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] xl:min-h-[calc(100vh-5rem)] 2xl:min-h-[calc(100vh-6rem)] bg-background text-text-main">
      <main className="max-w-7xl mx-auto px-2 py-4">{children}</main>
    </div>
  );
}
