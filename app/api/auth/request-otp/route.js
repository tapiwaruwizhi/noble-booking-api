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
    // Parse defensively: an empty or non-JSON body used to throw and surface as
    // a generic 500, which hid the real problem. Now it falls through to the
    // 400 below with diagnostics attached.
    const payload = await req.json().catch(() => null);
    const { identifier, code } = payload ?? {};

    if (!identifier || !code) {
      // This guard fired with no logging for a long time, which made
      // "identifier and code are required" impossible to diagnose from the
      // Vercel logs — you couldn't tell a malformed request from a missing
      // field from a client sending nothing at all. Log the SHAPE of what
      // arrived (never the code itself — it's a short-lived credential).
      console.warn("[/api/auth/verify-otp] 400 — rejected request:", JSON.stringify({
        body_parsed:        payload !== null,
        body_keys:          payload ? Object.keys(payload) : null,
        identifier_present: Boolean(identifier),
        identifier_type:    typeof identifier,
        code_present:       Boolean(code),
        code_type:          typeof code,
        code_length:        typeof code === "string" ? code.length : null,
        content_type:       req.headers.get("content-type"),
        // No Origin => a native app (RN sends none). A URL => the web portal.
        origin:             req.headers.get("origin") ?? "(none — native app or server-to-server)",
        user_agent:         (req.headers.get("user-agent") || "").slice(0, 90),
      }));

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

    // The token is returned in the body as well as set as a cookie.
    // Web ignores `token` and keeps using the httpOnly cookie; the React Native
    // app has no cookie jar, so it stores this in expo-secure-store and sends it
    // as `Authorization: Bearer`. Same token, same signature, same expiry —
    // see lib/requireAuth.js.
    const r = NextResponse.json({
      success:   true,
      firstName: contactData.firstName,
      token,
      expires_in: SESSION_MAX_AGE,
    });
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