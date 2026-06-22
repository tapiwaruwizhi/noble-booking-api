// src/app/api/contact/route.js
// GET /api/contact?email=X  or  GET /api/contact?phone=X
//
// Uses /v1/contactdetail to search directly by value (email or phone),
// then fetches the full contact + animals using the returned contact_id.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS       = process.env.ALLOWED_ORIGIN ?? "*";
const EMAIL_TYPE = 1;
const PHONE_TYPE = 3;

const normalizePhone = (val = "") => val.replace(/[\s\-().+]/g, "");

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const phone = searchParams.get("phone")?.trim();

    if (!email && !phone)
      return NextResponse.json({ error: "email or phone required" }, { status: 400 });

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── Step 1: Search contactdetail by value ─────────────────────────────────
    // Try email first, then phone as fallback
    let contactId = null;

    const searchValue = email ?? phone;
    const cdRes = await fetch(
      `${base}/v1/contactdetail?active=1&value=${encodeURIComponent(searchValue)}&limit=10`,
      { headers }
    );
    const cdData = await cdRes.json();
    const details = cdData.items ?? [];

    console.log("[/api/contact] contactdetail search for:", searchValue, "— found:", details.length);

    // Filter to correct type_id and exact value match
    const expectedTypeId = email ? EMAIL_TYPE : PHONE_TYPE;
    const match = details.find(i => {
      const d = i.contactdetail ?? i;
      if (d.type_id !== expectedTypeId) return false;
      if (email) return d.value?.trim().toLowerCase() === email;
      if (phone) return normalizePhone(d.value) === normalizePhone(phone);
      return false;
    });

    if (match) {
      const d = match.contactdetail ?? match;
      contactId = d.contact_id;
      console.log("[/api/contact] Found via contactdetail — contact_id:", contactId);
    }

    // ── Step 2: If not found by contactdetail, fall back to paginating contacts
    // (handles cases where contactdetail search misses due to formatting)
    if (!contactId && phone) {
      console.log("[/api/contact] Falling back to contact pagination for phone:", phone);
      let page = 1;
      const limit = 200;
      outer: while (true) {
        const res   = await fetch(
          `${base}/v1/contact?active=1&is_customer=1&limit=${limit}&page=${page}`,
          { headers }
        );
        const data  = await res.json();
        const items = data.items ?? [];
        if (items.length === 0) break;
        for (const i of items) {
          const c = i.contact ?? i;
          const found = (c.contact_detail_list ?? []).some(
            d => d.type_id === PHONE_TYPE &&
                 normalizePhone(d.value) === normalizePhone(phone)
          );
          if (found) { contactId = c.id; break outer; }
        }
        if (items.length < limit) break;
        page++;
      }
    }

    // ── Step 3: Not found → return found: false ───────────────────────────────
    if (!contactId) {
      console.log("[/api/contact] No contact found for:", searchValue);
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    // ── Step 4: Fetch full contact record ─────────────────────────────────────
    const cRes  = await fetch(`${base}/v1/contact/${contactId}`, { headers });
    const cData = await cRes.json();
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    // ── Step 5: Fetch animals ─────────────────────────────────────────────────
    const aRes  = await fetch(
      `${base}/v1/animal?active=1&contact_id=${contact.id}&limit=20`,
      { headers }
    );
    const aData   = await aRes.json();
    const animals = (aData.items ?? []).map(i => {
      const a   = i.animal ?? i;
      const dob = a.date_of_birth ? new Date(a.date_of_birth * 1000) : null;
      return {
        id:      a.id,
        uid:     a.uid,
        name:    a.name,
        species: a.species_name,
        breed:   a.breed_name,
        age:     dob
          ? `${Math.max(0, Math.floor((Date.now() - dob) / 31_536_000_000))} years`
          : "Unknown",
      };
    });

    const detailList    = contact.contact_detail_list ?? [];
    const email_address = detailList.find(d => d.type_id === EMAIL_TYPE)?.value ?? email ?? "";
    const phone_number  = detailList.find(d => d.type_id === PHONE_TYPE)?.value ?? phone ?? "";

    const r = NextResponse.json({
      found: true,
      contact: {
        id:         contact.id,
        uid:        contact.uid,
        first_name: contact.first_name,
        last_name:  contact.last_name,
        email:      email_address,
        phone:      phone_number,
      },
      animals,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/contact]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}