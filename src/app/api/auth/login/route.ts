import { NextResponse } from "next/server";
import { loginUser } from "@/app/actions/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    // Extract IP from forwarded headers (Vercel / proxies)
    const ipHeader =
      (req.headers?.get && req.headers.get("x-forwarded-for")) ||
      (req.headers?.get && req.headers.get("x-real-ip"));
    const ip = ipHeader ? ipHeader.split(",")[0].trim() : undefined;

    const result = await loginUser(email, password, ip);

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    // Set the HttpOnly session cookie directly in the login response
    const secure = process.env.NODE_ENV === "production";
    const maxAge = 7 * 24 * 60 * 60; // 7 days

    const res = NextResponse.json({ success: true });

    res.cookies.set("session", result.sessionToken!, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge,
    });

    return res;
  } catch (err) {
    console.error("Login API error", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
