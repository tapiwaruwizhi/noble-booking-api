// src/app/api/auth/request-otp/route.js
// POST { identifier: "email or phone" }
//
// Looks up the contact in ezyVet, generates a 6-digit code, stores it
// temporarily, and sends it — by real email via Resend when the identifier
// is an email address (see lib/email.js), or logged to the console as a
// fallback (and always for phone/SMS, which isn't wired up yet).
//
// If NO contact matches, we email a one-time /signup?token=… link instead of
// a code, so a new client can create an account rather than hitting a dead end.
//
// SECURITY NOTE: always returns { sent: true } regardless of which of the two
// emails went out, to avoid leaking which addresses are registered clients
// (enumeration protection). The two paths must stay indistinguishable in
// status code, body and — as far as is practical — timing.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { generateCode, storeOtp, sendOtp } from "@/lib/otp";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { isEmail, normalizeEmail, sendSignupLinkEmail } from "@/lib/email";
import { createSignupToken } from "@/lib/signupToken";
import { getApiOrigin } from "@/lib/appUrl";


const normalizePhone = (v = "") => v.replace(/[\s\-().+]/g, "");

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => null);
    const identifier = payload?.identifier;
    if (!identifier || typeof identifier !== "string") {
      // Symmetric with verify-otp: log the SHAPE of a rejected request so the
      // Vercel logs distinguish "wrong route", "empty body" and "missing field"
      // instead of leaving a bare 400.
      console.warn("[/api/auth/request-otp] 400 — rejected request:", JSON.stringify({
        body_parsed: payload !== null,
        body_keys:   payload ? Object.keys(payload) : null,
        identifier_type: typeof identifier,
        content_type: req.headers.get("content-type"),
        origin:      req.headers.get("origin") ?? "(none — native app)",
        user_agent:  (req.headers.get("user-agent") || "").slice(0, 90),
      }));
      const r = NextResponse.json({ error: "identifier is required" }, { status: 400 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    // ── Email only ────────────────────────────────────────────────────────
    // Sign-in is email-based. SMS delivery has never been implemented (sendOtp
    // only console-logs for phone numbers), so accepting a phone number here
    // used to send the client to a "check your messages" screen for a code
    // that was never going to arrive. Rejecting it up front, with a message
    // that says why, is the honest behaviour.
    const val = normalizeEmail(identifier);
    if (!isEmail(val)) {
      console.warn("[/api/auth/request-otp] 400 — not an email address:", JSON.stringify({
        looks_like_phone: /^[+\d][\d\s\-().]{6,}$/.test(String(identifier).trim()),
        length: String(identifier).trim().length,
        origin: req.headers.get("origin") ?? "(none — native app)",
      }));
      const r = NextResponse.json(
        { error: "Please enter a valid email address. Sign-in codes are sent by email — call the clinic if we only have your phone number on file." },
        { status: 400 }
      );
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }
    const emailMode = true;

    console.log("═══════════════════════════════════════");
    console.log("[/api/auth/request-otp] identifier:", val, "| type:", emailMode ? "email" : "phone");

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── Look up contact via contactdetail (same pattern as /api/contact) ────
    const cdRes  = await fetch(`${base}/v1/contactdetail?active=1&value=${encodeURIComponent(val)}&limit=10`, { headers });
    const cdText = await cdRes.text();
    console.log("[/api/auth/request-otp] contactdetail status:", cdRes.status);

    let contactId = null;
    if (cdRes.ok) {
      const cdData = JSON.parse(cdText);
      const expectedType = emailMode ? "1" : "3";
      const match = (cdData.items ?? []).find(i => {
        const d = i.contactdetail ?? i;
        const typeId = String(d.contact_detail_type_id ?? d.type_id ?? "");
        if (typeId !== expectedType) return false;
        if (emailMode) return d.value?.trim().toLowerCase() === val.toLowerCase();
        return normalizePhone(d.value) === normalizePhone(val);
      });
      if (match) contactId = (match.contactdetail ?? match).contact_id;
    }

    if (!contactId) {
      // ── No record of this person → email them a sign-up link ──────────────
      //
      // This used to be a dead end: we returned { sent: true } and sent nothing,
      // so a brand-new client sat on the "enter your code" screen forever. Now
      // they get a one-time /signup?token=… link instead.
      //
      // The RESPONSE BODY IS UNCHANGED on purpose. { sent: true } either way is
      // what keeps this route from being an account-enumeration oracle — the
      // caller must not be able to tell "existing client, code sent" from
      // "new person, signup link sent". Do not add a `new_user: true` flag here
      // to make the UI nicer; put the explanation in the copy on the code
      // screen instead ("if we don't recognise your email we've sent you a
      // link to create an account").
      console.log("[/api/auth/request-otp] No contact found — sending signup link (anti-enumeration response unchanged)");
      try {
        const signupToken = await createSignupToken(val);
        const link = `${getApiOrigin(req)}/signup?token=${encodeURIComponent(signupToken)}`;
        await sendSignupLinkEmail(val, link);
      } catch (err) {
        // A failed signup email must not turn into a 500 — that would itself
        // leak "this address is not a client" to anyone watching status codes.
        console.error("[/api/auth/request-otp] signup link send failed:", err);
      }
      console.log("═══════════════════════════════════════");
      const r = NextResponse.json({ sent: true });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    // ── Fetch contact via v2 (for uid) ──────────────────────────────────────
    const cRes  = await fetch(`${base}/v2/contact?id=${contactId}&limit=1`, { headers });
    const cData = await cRes.json();
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      console.log("[/api/auth/request-otp] Contact record fetch failed — returning generic success");
      const r = NextResponse.json({ sent: true });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const code = generateCode();
    await storeOtp(val, code, {
      contactId:  contact.id,
      contactUid: contact.uid,
      firstName:  contact.first_name,
      email:      emailMode ? val : null,
    });
    await sendOtp(val, code, emailMode, contact.first_name);

    console.log("[/api/auth/request-otp] ✓ OTP issued for contact_id:", contactId);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ sent: true });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/auth/request-otp] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}