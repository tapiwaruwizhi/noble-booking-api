// src/app/api/auth/me/route.js
// GET — returns the logged-in contact's profile, or 401 if not logged in.
// Fetches fresh data from ezyVet each time (not just what's in the session token).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    const cRes  = await fetch(`${base}/v2/contact?id=${session.contactId}&limit=1`, { headers });
    const cData = await cRes.json();
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      const r = NextResponse.json({ error: "Profile not found" }, { status: 404 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const EMAIL_TYPE = 1, PHONE_TYPE = 3;
    const details = contact.contact_detail_list ?? [];
    const getTypeId = (d) => Number(d.contact_detail_type_id ?? d.type_id ?? 0);
    const email = details.find(d => getTypeId(d) === EMAIL_TYPE)?.value ?? "";
    const phone = details.find(d => getTypeId(d) === PHONE_TYPE)?.value ?? "";

    const r = NextResponse.json({
      contact: {
        id:         contact.id,
        uid:        contact.uid,
        first_name: contact.first_name,
        last_name:  contact.last_name,
        email,
        phone,
      },
    });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/auth/me] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

// ── PATCH — update profile fields (first_name, last_name, phone) ───────────
// Phone is stored as a separate contactdetail record (type_id 3), not a
// plain field on the contact — so this upserts that record: updates it if
// one already exists, creates a new one if not.
export async function PATCH(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { first_name, last_name, phone } = await req.json();

    const token    = await getAccessToken();
    const base     = process.env.EZYVET_BASE_URL;
    const headers  = { Authorization: `Bearer ${token}` };
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };

    console.log("═══════════════════════════════════════");
    console.log("[/api/auth/me PATCH] contact_id:", session.contactId, "| updates:", { first_name, last_name, phone });

    // ── Step 1: update name fields on the contact itself, if provided ──────
    if (first_name || last_name) {
      const payload = {};
      if (first_name) payload.first_name = first_name;
      if (last_name)  payload.last_name  = last_name;

      let nameRes  = await fetch(`${base}/v2/contact/${session.contactId}`, {
        method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload),
      });
      let nameText = await nameRes.text();
      console.log("[/api/auth/me PATCH] name update (v2 PATCH) status:", nameRes.status, nameText);

      if (!nameRes.ok && nameText.includes("unknown or unsupported")) {
        console.log("[/api/auth/me PATCH] PATCH unsupported on contact — trying PUT");
        nameRes  = await fetch(`${base}/v2/contact/${session.contactId}`, {
          method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload),
        });
        nameText = await nameRes.text();
        console.log("[/api/auth/me PATCH] name update (v2 PUT) status:", nameRes.status, nameText);
      }
    }

    // ── Step 2: upsert phone as a contactdetail record ──────────────────────
    if (phone) {
      const PHONE_TYPE = 3;
      const cRes  = await fetch(`${base}/v2/contact?id=${session.contactId}&limit=1`, { headers });
      const cData = await cRes.json();
      const contact = cData.items?.[0]?.contact ?? cData.contact;
      const details = contact?.contact_detail_list ?? [];
      const getTypeId = (d) => Number(d.contact_detail_type_id ?? d.type_id ?? 0);
      const existingPhone = details.find(d => getTypeId(d) === PHONE_TYPE);

      if (existingPhone) {
        console.log("[/api/auth/me PATCH] Updating existing phone contactdetail id:", existingPhone.id);

        const updatePayload = {
          value:                   phone,
          contact_id:              session.contactId,
          contact_detail_type_id:  String(PHONE_TYPE),
        };

        let updRes  = await fetch(`${base}/v1/contactdetail/${existingPhone.id}`, {
          method: "PATCH", headers: jsonHeaders, body: JSON.stringify(updatePayload),
        });
        let updText = await updRes.text();
        console.log("[/api/auth/me PATCH] v1 PATCH status:", updRes.status, updText);

        // If PATCH itself isn't a supported method here, try PUT instead
        if (!updRes.ok && updText.includes("unknown or unsupported")) {
          console.log("[/api/auth/me PATCH] PATCH unsupported — trying PUT instead");
          updRes  = await fetch(`${base}/v1/contactdetail/${existingPhone.id}`, {
            method: "PUT", headers: jsonHeaders, body: JSON.stringify(updatePayload),
          });
          updText = await updRes.text();
          console.log("[/api/auth/me PATCH] v1 PUT status:", updRes.status, updText);
        }

        if (!updRes.ok) {
          const r = NextResponse.json({ error: "Failed to update phone", detail: updText }, { status: 502 });
          Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
          return r;
        }
      } else {
        console.log("[/api/auth/me PATCH] No existing phone — creating new contactdetail");
        const createRes  = await fetch(`${base}/v2/contactdetail`, {
          method: "POST", headers: jsonHeaders,
          body: JSON.stringify({
            contact_id: session.contactId,
            name:       "Mobile",
            value:      phone,
            type_id:    PHONE_TYPE,
            preferred:  1,
          }),
        });
        const createText = await createRes.text();
        console.log("[/api/auth/me PATCH] phone create status:", createRes.status, createText);
        if (!createRes.ok) {
          const r = NextResponse.json({ error: "Failed to add phone", detail: createText }, { status: 502 });
          Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
          return r;
        }
      }
    }

    console.log("[/api/auth/me PATCH] ✓ Profile updated");
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/auth/me PATCH] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}