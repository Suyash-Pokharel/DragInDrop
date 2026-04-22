import { NextResponse } from "next/server";
import { registerUser } from "@/app/actions/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, fingerprint } = body || {};
    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const ipHeader =
      (req.headers?.get && req.headers.get("x-forwarded-for")) ||
      (req.headers?.get && req.headers.get("x-real-ip"));
    const ip = ipHeader ? ipHeader.split(",")[0].trim() : undefined;

    const result = await registerUser({ name, email }, ip, fingerprint);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Register API error", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
