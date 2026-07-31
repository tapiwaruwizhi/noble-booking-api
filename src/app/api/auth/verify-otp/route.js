// src/app/api/auth/verify-otp/route.js
// POST { identifier, code }
//
// Verifies the OTP code and, if valid, issues a signed session cookie.

import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

export async function POST(req) {
  try {
    const { identifier, code } = await req.json();
    if (!identifier || !code) {
      return NextResponse.json({ error: "identifier and code are required" }, { status: 400 });
    }

    console.log("[/api/auth/verify-otp] Verifying code for:", identifier);

    const contactData = await verifyOtp(identifier.trim(), code.trim());
    if (!contactData) {
      console.log("[/api/auth/verify-otp] ✗ Invalid or expired code");
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const token = createSessionToken({
      contactId:  contactData.contactId,
      contactUid: contactData.contactUid,
      email:      contactData.email,
      firstName:  contactData.firstName,
    });

    console.log("[/api/auth/verify-otp] ✓ Session created for contact_id:", contactData.contactId);

    const r = NextResponse.json({ success: true, firstName: contactData.firstName });
    r.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/auth/verify-otp] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}