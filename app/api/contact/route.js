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

    console.log("═══════════════════════════════════════");
    console.log("[/api/contact] STEP 0 — incoming request");
    console.log("[/api/contact] email:", email, "| phone:", phone);
    console.log("[/api/contact] base:", base);

    // ── Step 1: Search contactdetail by value ─────────────────────────────────
    let contactId = null;
    const searchValue = email ?? phone;
    const cdUrl = `${base}/v1/contactdetail?active=1&value=${encodeURIComponent(searchValue)}&limit=10`;

    console.log("─────────────────────────────────────────");
    console.log("[/api/contact] STEP 1 — contactdetail search");
    console.log("[/api/contact] URL:", cdUrl);

    const cdRes  = await fetch(cdUrl, { headers });
    const cdText = await cdRes.text();
    console.log("[/api/contact] contactdetail status:", cdRes.status);
    console.log("[/api/contact] contactdetail response:", cdText);

    const cdData  = JSON.parse(cdText);
    const details = cdData.items ?? [];
    console.log("[/api/contact] contactdetail items found:", details.length);

    // Filter to correct type_id and exact value match
    // NOTE: v1 contactdetail uses "contact_detail_type_id" not "type_id"
    const expectedTypeId = email ? String(EMAIL_TYPE) : String(PHONE_TYPE);
    const match = details.find(i => {
      const d = i.contactdetail ?? i;
      const typeId = String(d.contact_detail_type_id ?? d.type_id ?? "");
      const cid    = d.contact_id ?? d.contactId;
      console.log("[/api/contact] checking detail — contact_detail_type_id:", typeId, "value:", d.value, "contact_id:", cid);
      if (typeId !== expectedTypeId) return false;
      if (email) return d.value?.trim().toLowerCase() === email;
      if (phone) return normalizePhone(d.value) === normalizePhone(phone);
      return false;
    });

    if (match) {
      const d = match.contactdetail ?? match;
      contactId = d.contact_id ?? d.contactId;
      console.log("[/api/contact] ✓ Match found — contact_id:", contactId);
    } else {
      console.log("[/api/contact] ✗ No match in contactdetail results");
    }

    // ── Step 2: Phone fallback — paginate contacts ────────────────────────────
    if (!contactId && phone) {
      console.log("─────────────────────────────────────────");
      console.log("[/api/contact] STEP 2 — phone fallback pagination");
      let page = 1;
      const limit = 200;
      outer: while (true) {
        const pgUrl  = `${base}/v1/contact?active=1&is_customer=1&limit=${limit}&page=${page}`;
        console.log("[/api/contact] Fetching page", page, ":", pgUrl);
        const res    = await fetch(pgUrl, { headers });
        const pgText = await res.text();
        console.log("[/api/contact] Page", page, "status:", res.status);
        const data   = JSON.parse(pgText);
        const items  = data.items ?? [];
        console.log("[/api/contact] Page", page, "items:", items.length);
        if (items.length === 0) break;
        for (const i of items) {
          const c = i.contact ?? i;
          const found = (c.contact_detail_list ?? []).some(d => {
            const typeId = Number(d.contact_detail_type_id ?? d.type_id ?? 0);
            return typeId === PHONE_TYPE &&
                   normalizePhone(d.value) === normalizePhone(phone);
          });
          if (found) {
            contactId = c.id;
            console.log("[/api/contact] ✓ Phone match found on page", page, "— contact_id:", contactId);
            break outer;
          }
        }
        if (items.length < limit) break;
        page++;
      }
      if (!contactId) console.log("[/api/contact] ✗ No phone match found after pagination");
    }

    // ── Step 3: Not found ─────────────────────────────────────────────────────
    if (!contactId) {
      console.log("─────────────────────────────────────────");
      console.log("[/api/contact] STEP 3 — no contact found, returning found: false");
      console.log("═══════════════════════════════════════");
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    // ── Step 4: Fetch full contact record ─────────────────────────────────────
    // Use v2 to get uid (v1 does not return uid field)
    const cUrl = `${base}/v2/contact?id=${contactId}&limit=1`;
    console.log("─────────────────────────────────────────");
    console.log("[/api/contact] STEP 4 — fetching full contact record (v2 for uid)");
    console.log("[/api/contact] URL:", cUrl);

    const cRes  = await fetch(cUrl, { headers });
    const cText = await cRes.text();
    console.log("[/api/contact] contact fetch status:", cRes.status);
    console.log("[/api/contact] contact fetch response:", cText);

    const cData   = JSON.parse(cText);
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      console.log("[/api/contact] ✗ Contact record not found in response");
      console.log("═══════════════════════════════════════");
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    console.log("[/api/contact] ✓ Contact:", contact.first_name, contact.last_name, "| uid:", contact.uid);

    // ── Step 5: Fetch animals (v2 for uid) ───────────────────────────────────
    const aUrl = `${base}/v2/animal?active=1&contact_id=${contact.id}&limit=20`;
    console.log("─────────────────────────────────────────");
    console.log("[/api/contact] STEP 5 — fetching animals");
    console.log("[/api/contact] URL:", aUrl);

    const aRes  = await fetch(aUrl, { headers });
    const aText = await aRes.text();
    console.log("[/api/contact] animals fetch status:", aRes.status);
    console.log("[/api/contact] animals fetch response:", aText);

    const aData   = JSON.parse(aText);
    const animals = (aData.items ?? []).map(i => {
      const a   = i.animal ?? i;
      const dob = a.date_of_birth ? new Date(a.date_of_birth * 1000) : null;
      console.log("[/api/contact] animal:", a.name, "| id:", a.id, "| uid:", a.uid, "| species:", a.species_name);
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

    console.log("[/api/contact] ✓ Animals found:", animals.length);

    const detailList    = contact.contact_detail_list ?? [];
    // v1 uses contact_detail_type_id, v2 uses type_id — handle both
    const getTypeId     = (d) => Number(d.contact_detail_type_id ?? d.type_id ?? 0);
    const email_address = detailList.find(d => getTypeId(d) === EMAIL_TYPE)?.value ?? email ?? "";
    const phone_number  = detailList.find(d => getTypeId(d) === PHONE_TYPE)?.value ?? phone ?? "";

    console.log("[/api/contact] ✓ Returning found: true");
    console.log("═══════════════════════════════════════");

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
    console.error("[/api/contact] UNCAUGHT ERROR:", err);
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
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