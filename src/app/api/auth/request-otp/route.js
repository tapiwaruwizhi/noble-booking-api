// src/app/api/auth/request-otp/route.js
// POST { identifier: "email or phone" }
//
// Looks up the contact in ezyVet, generates a 6-digit code, stores it
// temporarily, and "sends" it (currently a console-log stub — see
// src/lib/otp.js sendOtp() for where to wire a real email/SMS provider).
//
// SECURITY NOTE: always returns { sent: true } regardless of whether the
// contact was found, to avoid leaking which emails/phones are registered
// clients (enumeration protection).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { generateCode, storeOtp, sendOtp } from "@/lib/otp";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";
const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
const normalizePhone = (v = "") => v.replace(/[\s\-().+]/g, "");

export async function POST(req) {
  try {
    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json({ error: "identifier is required" }, { status: 400 });
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
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    // ── Fetch contact via v2 (for uid) ──────────────────────────────────────
    const cRes  = await fetch(`${base}/v2/contact?id=${contactId}&limit=1`, { headers });
    const cData = await cRes.json();
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      console.log("[/api/auth/request-otp] Contact record fetch failed — returning generic success");
      const r = NextResponse.json({ sent: true });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    const code = generateCode();
    await storeOtp(val, code, {
      contactId:  contact.id,
      contactUid: contact.uid,
      firstName:  contact.first_name,
      email:      emailMode ? val : null,
    });
    await sendOtp(val, code, emailMode);

    console.log("[/api/auth/request-otp] ✓ OTP issued for contact_id:", contactId);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ sent: true });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/auth/request-otp] error:", err);
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