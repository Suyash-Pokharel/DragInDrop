"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { StaticImageData } from "next/image";
import UserNavbar from "./UserNavbar";
import PublicNavbar from "./PublicNavbar";

interface NavbarProps {
  imageSrc?: string | StaticImageData;
}

// Placeholder for future auth logic
const userRole = "admin";
const isAdminUser = userRole === "admin";

const NavbarWrapper = ({ imageSrc }: NavbarProps) => {
  const pathname = usePathname();

  // 1. Pages with NO Navbar (Login, Register, etc.)
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/createpassword" ||
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
      <UserNavbar imageSrc={imageSrc} isAdmin={isAdminUser} />
    </div>
  );
};

export default NavbarWrapper;