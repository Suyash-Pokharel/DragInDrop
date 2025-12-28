import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./navbar/Navbar";

// 👇 IMPORTANT: This file MUST exist in your "src/app/assets/" folder
// If it is missing, delete this line and remove "imageSrc={localProfile}"
import localProfile from "./assets/profile-pic.jpg"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DragInDrop",
  description: "User Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {/* Navbar loads first (Step 1) */}
          <Navbar imageSrc={localProfile} />
          
          {/* Page Content loads last (Step 3) */}
          <div className="load-step-3">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}