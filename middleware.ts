import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware verifies the HMAC-signed session cookie and injects headers
// containing `x-session-sub` and `x-session-email` for downstream handlers.
// This runs in the Edge runtime, so we use Web Crypto APIs.

async function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToString(b64url: string) {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  // atob decodes to a binary string
  const binary = atob(s);
  // Convert binary string to normal utf-8 string
  try {
    // TextDecoder might not be necessary for simple JSON payloads, but is safe
    const bytes = new Uint8Array(binary.split("").map((c) => c.charCodeAt(0)));
    return new TextDecoder().decode(bytes);
  } catch {
    return binary;
  }
}

async function verifyTokenEdge(token: string, secret: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    const unsigned = `${headerB64}.${bodyB64}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(unsigned),
    );
    const expected = await toBase64Url(signature);
    if (expected !== sig) return null;

    const payloadJson = base64UrlDecodeToString(bodyB64);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// Routes that require a valid session to access
const PROTECTED_ROUTES = ["/dashboard", "/admin"];

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

  // --- Guard: Protected routes require a valid session ---
  if (!isProtectedRoute(pathname)) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyTokenEdge(token, secret);
  if (!payload) {
    // Clear the invalid/expired session cookie and redirect
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set("session", "", { path: "/", maxAge: 0 });
    return response;
  }

  const newHeaders = new Headers(req.headers);
  if (payload.sub) newHeaders.set("x-session-sub", String(payload.sub));
  if (payload.email) newHeaders.set("x-session-email", String(payload.email));

  return NextResponse.next({ request: { headers: newHeaders } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/createpassword"],
};
