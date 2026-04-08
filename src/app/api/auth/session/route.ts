import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token;
    if (!token)
      return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const secure = process.env.NODE_ENV === "production";
    const maxAge = 7 * 24 * 60 * 60; // 7 days

    const res = NextResponse.json({ ok: true });

    res.cookies.set("session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
