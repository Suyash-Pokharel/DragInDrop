import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes that require a valid session to access
const PROTECTED_ROUTES = ["/dashboard", "/admin"];

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

const AUTH_ROUTES = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // --- Redirect logged in users away from auth pages ---
  if (isLoggedIn && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // --- Guard: /createpassword requires a ?token= query param ---
  if (pathname === "/createpassword") {
    // We let logged in users access this? No, usually they shouldn't need it.
    if (isLoggedIn) {
       return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    const tokenParam = req.nextUrl.searchParams.get("token");
    if (!tokenParam || tokenParam.trim() === "") {
      return NextResponse.redirect(new URL("/register", req.url));
    }
    return NextResponse.next();
  }

  // --- Guard: Protected routes require a valid session ---
  if (isProtectedRoute(pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

