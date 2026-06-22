// src/app/api/book/route.js
// POST /api/book — with detailed logging on each step for debugging

import { NextResponse } from "next/server";
import { getAccessToken } from "../../../lib/ezyvet/auth";

const CORS         = process.env.ALLOWED_ORIGIN ?? "*";
const BOOKING_BASE = process.env.EZYVET_EZYCAB_BASE_URL ?? "https://apiv2.trial.ezyvet.com";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      email, owner_name, owner_phone,
      contact_id:  existingContactId,
      contact_uid: existingContactUid,
      animal_id:   existingAnimalId,
      animal_uid:  existingAnimalUid,
      new_pet,
      appt_type_uid,
      resource_uid,
      start_time,
      start_iso,
      end_time,
      duration,
      description,
    } = body;

    console.log("═══════════════════════════════════════");
    console.log("[/api/book] STEP 0 — incoming payload:");
    console.log(JSON.stringify({
      email, owner_name, owner_phone,
      existingContactId, existingContactUid,
      existingAnimalId, existingAnimalUid,
      new_pet, appt_type_uid, resource_uid,
      start_time, start_iso, end_time, duration, description,
    }, null, 2));

    const token    = await getAccessToken();
    const base     = process.env.EZYVET_BASE_URL;
    const authJson = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    console.log("[/api/book] Token obtained ✓");
    console.log("[/api/book] EZYVET_BASE_URL:", base);
    console.log("[/api/book] BOOKING_BASE:", BOOKING_BASE);

    let contact_id  = existingContactId;
    let contact_uid = existingContactUid;
    let animal_id   = existingAnimalId;
    let animal_uid  = existingAnimalUid;

    // ── STEP 1: Create contact if new ────────────────────────────────────────
    if (!contact_id && !contact_uid) {
      console.log("─────────────────────────────────────────");
      console.log("[/api/book] STEP 1 — creating new contact (no existing contact provided)...");
      const [first, ...rest] = (owner_name ?? "").trim().split(" ");
      const contactPayload = {
        first_name:  first,
        last_name:   rest.join(" ") || "-",
        is_customer: 1,
        contact_detail_list: [
          ...(email ? [{
            name:                   "Email",
            value:                  email,
            contact_detail_type_id: "1",
            preferred:              1,
          }] : []),
          ...(owner_phone ? [{
            name:                   "Mobile",
            value:                  owner_phone,
            contact_detail_type_id: "3",
            preferred:              0,
          }] : []),
        ],
      };
      console.log("[/api/book] Contact payload:", JSON.stringify(contactPayload));

      const cRes  = await fetch(`${base}/v1/contact`, {
        method: "POST", headers: authJson,
        body: JSON.stringify(contactPayload),
      });
      const cText = await cRes.text();
      console.log("[/api/book] Contact response status:", cRes.status);
      console.log("[/api/book] Contact response body:", cText);

      if (!cRes.ok) {
        return NextResponse.json({
          error:  "Failed to create contact",
          step:   "create_contact",
          status: cRes.status,
          detail: cText,
        }, { status: 502 });
      }

      const cData = JSON.parse(cText);
      const c     = cData.items?.[0]?.contact ?? cData.contact;
      contact_id  = c?.id;
      contact_uid = c?.uid;
      console.log("[/api/book] Contact created — id:", contact_id, "uid:", contact_uid);

      if (!contact_uid && !contact_id) {
        return NextResponse.json({
          error:  "Contact created but no ID returned",
          step:   "create_contact",
          detail: cData,
        }, { status: 502 });
      }
    } else {
      console.log("[/api/book] STEP 1 — using existing contact id:", contact_id, "uid:", contact_uid);
    }

    // ── STEP 2: Create animal if new ─────────────────────────────────────────
    if (!animal_id && !animal_uid && new_pet) {
      console.log("─────────────────────────────────────────");
      console.log("[/api/book] STEP 2 — creating new animal...");
      const animalPayload = {
        name:       new_pet.name,
        contact_id: contact_id,
        species:    new_pet.species ?? "Dog",
        breed:      new_pet.breed   ?? "",
        active:     1,
      };
      console.log("[/api/book] Animal payload:", JSON.stringify(animalPayload));

      const aRes  = await fetch(`${base}/v1/animal`, {
        method: "POST", headers: authJson,
        body: JSON.stringify(animalPayload),
      });
      const aText = await aRes.text();
      console.log("[/api/book] Animal response status:", aRes.status);
      console.log("[/api/book] Animal response body:", aText);

      if (!aRes.ok) {
        return NextResponse.json({
          error:  "Failed to create animal",
          step:   "create_animal",
          status: aRes.status,
          detail: aText,
        }, { status: 502 });
      }

      const aData = JSON.parse(aText);
      const a     = aData.items?.[0]?.animal ?? aData.animal;
      animal_id   = a?.id;
      animal_uid  = a?.uid;
      console.log("[/api/book] Animal created — id:", animal_id, "uid:", animal_uid);

      if (!animal_uid && !animal_id) {
        return NextResponse.json({
          error:  "Animal created but no ID returned",
          step:   "create_animal",
          detail: aData,
        }, { status: 502 });
      }
    } else {
      console.log("[/api/book] STEP 2 — using existing animal id:", animal_id, "uid:", animal_uid);
    }

    // ── STEP 3: Build startTime ───────────────────────────────────────────────
    console.log("─────────────────────────────────────────");
    console.log("[/api/book] STEP 3 — building startTime...");
    const startTimeISO = start_iso
      ?? (start_time ? new Date(start_time * 1000).toISOString() : null);
    console.log("[/api/book] start_iso:", start_iso);
    console.log("[/api/book] start_time:", start_time);
    console.log("[/api/book] startTimeISO resolved to:", startTimeISO);

    if (!startTimeISO) {
      return NextResponse.json({
        error: "start_time or start_iso is required",
        step:  "build_start_time",
      }, { status: 400 });
    }

    let durationMinutes = duration ?? 30;
    if (!duration && start_time && end_time) {
      durationMinutes = Math.round((end_time - start_time) / 60);
    }
    console.log("[/api/book] durationMinutes:", durationMinutes);

    // ── STEP 4: Resolve UIDs if only numeric IDs available ───────────────────
    console.log("─────────────────────────────────────────");
    console.log("[/api/book] STEP 4 — resolving UIDs");
    console.log("[/api/book] contact_id:", contact_id, "| contact_uid:", contact_uid);
    console.log("[/api/book] animal_id:", animal_id, "| animal_uid:", animal_uid);

    if (!contact_uid && contact_id) {
      console.log("[/api/book] Looking up contact UID for id:", contact_id);
      const cRes  = await fetch(`${base}/v1/contact/${contact_id}`, { headers: authJson });
      const cText = await cRes.text();
      console.log("[/api/book] Contact lookup status:", cRes.status);
      console.log("[/api/book] Contact lookup response:", cText);
      const cData = JSON.parse(cText);
      const c     = cData.items?.[0]?.contact ?? cData.contact;
      contact_uid = c?.uid;
      console.log("[/api/book] Resolved contact_uid:", contact_uid);
    }

    if (!animal_uid && animal_id) {
      console.log("[/api/book] Looking up animal UID for id:", animal_id);
      const aRes  = await fetch(`${base}/v1/animal/${animal_id}`, { headers: authJson });
      const aText = await aRes.text();
      console.log("[/api/book] Animal lookup status:", aRes.status);
      console.log("[/api/book] Animal lookup response:", aText);
      const aData = JSON.parse(aText);
      const a     = aData.items?.[0]?.animal ?? aData.animal;
      animal_uid  = a?.uid;
      console.log("[/api/book] Resolved animal_uid:", animal_uid);
    }

    // Last resort — if still no contact UID, search via contactdetail
    if (!contact_uid && (email || owner_phone)) {
      console.log("[/api/book] Last resort — searching contactdetail for contact UID...");
      const searchVal = email || owner_phone;
      const cdRes  = await fetch(
        `${base}/v1/contactdetail?active=1&value=${encodeURIComponent(searchVal)}&limit=5`,
        { headers: authJson }
      );
      const cdText = await cdRes.text();
      console.log("[/api/book] contactdetail lookup status:", cdRes.status);
      console.log("[/api/book] contactdetail lookup response:", cdText);
      const cdData = JSON.parse(cdText);
      const detail = (cdData.items ?? [])[0]?.contactdetail ?? (cdData.items ?? [])[0];
      if (detail?.contact_id) {
        const cRes2  = await fetch(`${base}/v1/contact/${detail.contact_id}`, { headers: authJson });
        const cText2 = await cRes2.text();
        console.log("[/api/book] Contact from contactdetail status:", cRes2.status);
        console.log("[/api/book] Contact from contactdetail response:", cText2);
        const cData2 = JSON.parse(cText2);
        const c2     = cData2.items?.[0]?.contact ?? cData2.contact;
        contact_uid  = c2?.uid;
        contact_id   = c2?.id ?? detail.contact_id;
        console.log("[/api/book] Last resort resolved — contact_uid:", contact_uid, "contact_id:", contact_id);
      }
    }

    if (!contact_uid) {
      console.error("[/api/book] ✗ Could not resolve contact UID after all attempts");
      return NextResponse.json({ error: "Could not resolve contact UID", step: "resolve_uids", contact_id, contact_uid }, { status: 502 });
    }
    if (!animal_uid) {
      console.error("[/api/book] ✗ Could not resolve animal UID");
      return NextResponse.json({ error: "Could not resolve animal UID", step: "resolve_uids", animal_id, animal_uid }, { status: 502 });
    }

    console.log("[/api/book] ✓ UIDs resolved — contact_uid:", contact_uid, "| animal_uid:", animal_uid);

    // ── STEP 5: POST /ezycab/booking ─────────────────────────────────────────
    console.log("─────────────────────────────────────────");
    console.log("[/api/book] STEP 5 — posting booking...");
    const bookPayload = {
      startTime:           startTimeISO,
      type:                appt_type_uid,
      durationMinutes:     durationMinutes,
      appointmentStatus:   "unconfirmed",
      description:         description ?? "Online booking via Noble Vet website",
      animal:              animal_uid,
      contact:             contact_uid,
      provider:            resource_uid,
      additionalResources: [resource_uid],
    };

    console.log("[/api/book] Booking URL:", `${BOOKING_BASE}/ezycab/booking`);
    console.log("[/api/book] Booking payload:", JSON.stringify(bookPayload, null, 2));

    const bookRes  = await fetch(`${BOOKING_BASE}/ezycab/booking`, {
      method: "POST", headers: authJson,
      body: JSON.stringify(bookPayload),
    });
    const bookText = await bookRes.text();
    console.log("[/api/book] Booking response status:", bookRes.status);
    console.log("[/api/book] Booking response body:", bookText);

    if (!bookRes.ok) {
      return NextResponse.json({
        error:  "Booking failed",
        step:   "create_booking",
        status: bookRes.status,
        detail: bookText,
      }, { status: 502 });
    }

    const bookData = JSON.parse(bookText);
    const appt     = bookData.data?.[0] ?? bookData.appointment ?? bookData;
    const apptId   = appt?.id ?? appt?.uid;
    const ref      = `NVC-${(apptId ?? Math.random().toString(36).slice(2)).slice(-6).toUpperCase()}`;

    console.log("[/api/book] ✓ Booking successful — ref:", ref, "apptId:", apptId);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({
      success:         true,
      appointment_uid: apptId,
      contact_uid,
      animal_uid,
      reference: ref,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/book] UNCAUGHT ERROR:", err);
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  process.env.ALLOWED_ORIGIN ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}