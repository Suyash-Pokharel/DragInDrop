"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { StaticImageData } from "next/image";
import UserNavbar from "./UserNavbar";
import PublicNavbar from "./PublicNavbar";

interface NavbarProps {
    imageSrc?: string | StaticImageData;
}
const userRole = "admin"; // This would come from logic/hooks
const isAdminUser = userRole === "admin";

const NavbarWrapper = ({ imageSrc }: NavbarProps) => {
    const pathname = usePathname();

    // 1. Pages with NO Navbar (Login, Register, etc.)
    // Note: Add any other "standalone" pages here
    if (
        pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/createpassword" ||
        pathname === "/verification-sent"
    ) {
        return null;
    }

    // 2. Public Pages -> Show PublicNavbar
    // Add "/" for home, and any other public landing pages
    if (
        pathname === "/" ||
        pathname === "/pricing" ||
        pathname === "/contactus" ||
        pathname === "/terms" ||
        pathname === "/privacy"
    ) {
        return <PublicNavbar />;
    }

    // 3. All other pages (Dashboard, Calendar, etc.) -> Show UserNavbar
    return <UserNavbar imageSrc={imageSrc} isAdmin={isAdminUser} />;
};

export default NavbarWrapper;