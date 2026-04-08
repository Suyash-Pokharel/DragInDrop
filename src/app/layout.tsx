import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./navbar/Navbar";
import { getCurrentUser } from "@/lib/getCurrentUser";

// 👇 IMPORTANT: This file MUST exist in your "src/app/assets/" folder
// If it is missing, delete this line and remove "imageSrc={localProfile}"
import localProfile from "./assets/profile-pic.jpg";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DragInDrop",
  description: "User Dashboard",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Navbar imageSrc={localProfile} user={user} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
