"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { StaticImageData } from "next/image";
import { PublicUser } from "@/lib/getCurrentUser";
import UserNavbar from "./UserNavbar";
import PublicNavbar from "./PublicNavbar";

interface NavbarProps {
  imageSrc?: string | StaticImageData;
  user?: PublicUser | null;
}

const NavbarWrapper = ({ imageSrc, user }: NavbarProps) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // Use session role as primary source (fresh data), fallback to server prop
  const isAdminUser = session?.user?.role === "ADMIN" || user?.role === "ADMIN";

  // 1. Pages with NO Navbar (Login, Register, etc.)
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/createpassword" ||
    pathname === "/resetpassword" ||
    pathname === "/verification-sent"
  ) {
    return null;
  }

  // 2. Public Pages -> Show PublicNavbar
  if (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/contactus" ||
    pathname === "/terms" ||
    pathname === "/privacy"
  ) {
    // Wrapped in load-step-1 for the staggered animation
    return (
      <div className="load-step-1 relative z-50">
        <PublicNavbar />
      </div>
    );
  }

  // 3. User Pages (Default) -> Show UserNavbar
  // This executes if none of the IF statements above matched
  return (
    <div className="load-step-1 relative z-50">
      <UserNavbar imageSrc={imageSrc} isAdmin={isAdminUser} user={user} />
    </div>
  );
};

export default NavbarWrapper;
