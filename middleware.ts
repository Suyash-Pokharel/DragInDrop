import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Middleware verifies the NextAuth session token and injects headers
// containing `x-user-id` and `x-user-email` for downstream handlers.
// This runs in the Edge runtime.

// Routes that require a valid session to access
const PROTECTED_ROUTES = ["/dashboard", "/admin", "/calendar", "/settings"];

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Guard: /createpassword requires a ?token= query param ---
  if (pathname === "/createpassword") {
    const tokenParam = req.nextUrl.searchParams.get("token");
    if (!tokenParam || tokenParam.trim() === "") {
      return NextResponse.redirect(new URL("/register", req.url));
    }
    return NextResponse.next();
  }

  // --- Guard: /resetpassword requires a ?token= query param ---
  if (pathname === "/resetpassword") {
    const tokenParam = req.nextUrl.searchParams.get("token");
    if (!tokenParam || tokenParam.trim() === "") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // --- Guard: Protected routes require a valid session ---
  if (!isProtectedRoute(pathname)) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin route protection
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Inject user headers for downstream handlers
  const newHeaders = new Headers(req.headers);
  if (token.sub) newHeaders.set("x-user-id", String(token.sub));
  if (token.email) newHeaders.set("x-user-email", String(token.email));

  // Add cache control headers to prevent browser caching of authenticated pages
  const response = NextResponse.next({ request: { headers: newHeaders } });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/calendar/:path*", "/settings/:path*", "/createpassword", "/resetpassword"],
};
