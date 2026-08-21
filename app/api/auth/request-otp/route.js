// src/app/api/auth/request-otp/route.js
// POST { identifier: "email or phone" }
//
// Looks up the contact in ezyVet, generates a 6-digit code, stores it
// temporarily, and sends it — by real email via Resend when the identifier
// is an email address (see lib/email.js), or logged to the console as a
// fallback (and always for phone/SMS, which isn't wired up yet).
//
// SECURITY NOTE: always returns { sent: true } regardless of whether the
// contact was found, to avoid leaking which emails/phones are registered
// clients (enumeration protection).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { generateCode, storeOtp, sendOtp } from "@/lib/otp";
import { getCredentialedCorsHeaders } from "@/lib/cors";


const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
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

    const val = identifier.trim();
    const emailMode = isEmail(val);

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
      console.log("[/api/auth/request-otp] No contact found — returning generic success (anti-enumeration)");
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