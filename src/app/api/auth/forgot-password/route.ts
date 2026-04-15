import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/app/actions/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const result = await requestPasswordReset(email);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Forgot password API error", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
