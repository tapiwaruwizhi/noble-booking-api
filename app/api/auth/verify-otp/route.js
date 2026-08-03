// src/app/api/auth/verify-otp/route.js
// POST { identifier, code }
//
// Verifies the OTP code and, if valid, issues a signed session cookie.

import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function POST(req) {
  try {
    const { identifier, code } = await req.json();
    if (!identifier || !code) {
      const r = NextResponse.json({ error: "identifier and code are required" }, { status: 400 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    console.log("[/api/auth/verify-otp] Verifying code for:", identifier);

    const contactData = await verifyOtp(identifier.trim(), code.trim());
    if (!contactData) {
      console.log("[/api/auth/verify-otp] ✗ Invalid or expired code");
      const r = NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
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
      sameSite: "none",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/auth/verify-otp] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}