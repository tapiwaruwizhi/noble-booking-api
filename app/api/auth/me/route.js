// src/app/api/auth/me/route.js
// GET — returns the logged-in contact's full profile.
// PATCH — updates any editable profile field (name, phone, emirates_id,
// date_of_birth, business_name, passport_number, website, and both
// postal/physical addresses when an address record already exists).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { resolveAddress } from "@/lib/ezyvetAddress";

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

    // Postal/physical addresses are separate entities referenced by ID —
    // resolve both in parallel as structured objects (for editable form)
    const [postal, physical] = await Promise.all([
      resolveAddress(base, headers, contact.address_postal),
      resolveAddress(base, headers, contact.address_physical),
    ]);

    const dob = contact.date_of_birth ? new Date(contact.date_of_birth * 1000).toISOString().split("T")[0] : null;

    const r = NextResponse.json({
      contact: {
        id:            contact.id,
        uid:           contact.uid,
        first_name:    contact.first_name,
        last_name:     contact.last_name,
        email,
        phone,
        emirates_id:   contact.national_id_number || "",
        code:            contact.code || null,
        business_name:   contact.business_name || "",
        date_of_birth:   dob,
        passport_number: contact.passport_number || "",
        stop_credit:     contact.stop_credit || null,
        website:         contact.website || "",
        postal_address:    postal?.display   || null,
        physical_address:  physical?.display || null,
        // Structured — used to pre-fill the editable address form
        postal:   postal   || { id: null, street_1: "", street_2: "", suburb: "", city: "", state: "", postcode: "" },
        physical: physical || { id: null, street_1: "", street_2: "", suburb: "", city: "", state: "", postcode: "" },
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

// ── PATCH — update any editable profile field ───────────────────────────────
export async function PATCH(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const {
      first_name, last_name, phone, emirates_id,
      date_of_birth, business_name, passport_number, website,
    } = await req.json();

    const token    = await getAccessToken();
    const base     = process.env.EZYVET_BASE_URL;
    const headers  = { Authorization: `Bearer ${token}` };
    const jsonHeaders  = { ...headers, "Content-Type": "application/json" };
    const patchHeaders = { ...headers, "Content-Type": "application/merge-patch+json" };

    console.log("═══════════════════════════════════════");
    console.log("[/api/auth/me PATCH] contact_id:", session.contactId);
    console.log("[/api/auth/me PATCH] updates:", { first_name, last_name, phone, emirates_id, date_of_birth, business_name, passport_number, website });

    // ── Step 1: update all direct contact fields in one call ───────────────
    const hasContactFieldUpdate = first_name || last_name || emirates_id !== undefined ||
      date_of_birth !== undefined || business_name !== undefined || passport_number !== undefined || website !== undefined;

    if (hasContactFieldUpdate) {
      const payload = {};
      if (first_name)      payload.first_name = first_name;
      if (last_name)       payload.last_name  = last_name;
      if (emirates_id !== undefined)     payload.national_id_number = emirates_id;
      if (business_name !== undefined)   payload.business_name      = business_name;
      if (passport_number !== undefined) payload.passport_number    = passport_number;
      if (website !== undefined)         payload.website            = website;
      if (date_of_birth) payload.date_of_birth = Math.floor(new Date(date_of_birth).getTime() / 1000);

      let contactRes  = await fetch(`${base}/v1/contact/${session.contactId}`, {
        method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload),
      });
      let contactText = await contactRes.text();
      console.log("[/api/auth/me PATCH] contact update (v1 PATCH) status:", contactRes.status, contactText);

      if (!contactRes.ok && contactText.includes("unknown or unsupported")) {
        console.log("[/api/auth/me PATCH] PATCH unsupported on contact — trying PUT");
        contactRes  = await fetch(`${base}/v1/contact/${session.contactId}`, {
          method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload),
        });
        contactText = await contactRes.text();
        console.log("[/api/auth/me PATCH] contact update (v1 PUT) status:", contactRes.status, contactText);
      }

      if (!contactRes.ok) {
        const r = NextResponse.json({ error: "Failed to update profile", detail: contactText }, { status: 502 });
        Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
        return r;
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
        const updatePayload = {
          value:                   phone,
          contact_id:              session.contactId,
          contact_detail_type_id:  String(PHONE_TYPE),
        };

        let updRes  = await fetch(`${base}/v1/contactdetail/${existingPhone.id}`, {
          method: "PATCH", headers: patchHeaders, body: JSON.stringify(updatePayload),
        });
        let updText = await updRes.text();
        console.log("[/api/auth/me PATCH] phone v1 PATCH status:", updRes.status, updText);

        if (!updRes.ok && updText.includes("unknown or unsupported")) {
          updRes  = await fetch(`${base}/v1/contactdetail/${existingPhone.id}`, {
            method: "PUT", headers: jsonHeaders, body: JSON.stringify(updatePayload),
          });
          updText = await updRes.text();
          console.log("[/api/auth/me PATCH] phone v1 PUT status:", updRes.status, updText);
        }

        if (!updRes.ok) {
          const r = NextResponse.json({ error: "Failed to update phone", detail: updText }, { status: 502 });
          Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
          return r;
        }
      } else {
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