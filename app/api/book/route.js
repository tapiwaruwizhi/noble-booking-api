// src/app/api/book/route.js
// POST /api/book
//
// Creates contact (if new) → animal (if new) → booking via /ezycab/booking
// Request body shape per ezyVet docs (developers.ezyvet.com/#create-booking):
// {
//   startTime:           ISO 8601 string  e.g. "2025-07-14T09:30:00.000-04:00"
//   type:                appointmentType UID
//   durationMinutes:     number (minutes)
//   appointmentStatus:   "unconfirmed" | "confirmed" | "cancelled"
//   description:         string (optional)
//   animal:              animal UID
//   contact:             contact UID
//   provider:            resource UID
//   additionalResources: [resource UID, ...]  (optional)
// }

import { NextResponse } from "next/server";
import { getAccessToken } from "../../../lib/ezyvet/auth";

const CORS         = process.env.ALLOWED_ORIGIN ?? "*";
const BOOKING_BASE = process.env.EZYVET_EZYCAB_BASE_URL ?? "https://apiv2.trial.ezyvet.com";

export async function POST(req) {
  try {
    const {
      email, owner_name, owner_phone,
      contact_id:  existingContactId,
      contact_uid: existingContactUid,
      animal_id:   existingAnimalId,
      animal_uid:  existingAnimalUid,
      new_pet,
      appt_type_uid,
      resource_uid,
      start_time,      // Unix timestamp (seconds) from slots route
      start_iso,       // ISO string from slots route — preferred for booking
      end_time,
      duration,        // minutes — fallback to compute duration
      description,
    } = await req.json();

    const token     = await getAccessToken();
    const base      = process.env.EZYVET_BASE_URL;
    const authJson  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    let contact_id  = existingContactId;
    let contact_uid = existingContactUid;
    let animal_id   = existingAnimalId;
    let animal_uid  = existingAnimalUid;

    // ── 1. Create contact if new ─────────────────────────────────────────────
    if (!contact_id && !contact_uid) {
      const [first, ...rest] = (owner_name ?? "").trim().split(" ");
      const cRes  = await fetch(`${base}/v2/contact`, {
        method: "POST", headers: authJson,
        body: JSON.stringify({
          first_name: first,
          last_name:  rest.join(" ") || "-",
          email,
          phone:      owner_phone ?? "",
          active:     1,
        }),
      });
      const cData = await cRes.json();
      const c     = cData.items?.[0]?.contact ?? cData.contact;
      contact_id  = c?.id;
      contact_uid = c?.uid;
      if (!contact_uid && !contact_id) {
        console.error("[/api/book] contact creation failed", cData);
        return NextResponse.json({ error: "Failed to create contact" }, { status: 502 });
      }
    }

    // ── 2. Create animal if new ──────────────────────────────────────────────
    if (!animal_id && !animal_uid && new_pet) {
      const aRes  = await fetch(`${base}/v2/animal`, {
        method: "POST", headers: authJson,
        body: JSON.stringify({
          name:       new_pet.name,
          contact_id: contact_id,
          species:    new_pet.species ?? "Dog",
          breed:      new_pet.breed   ?? "",
          active:     1,
        }),
      });
      const aData = await aRes.json();
      const a     = aData.items?.[0]?.animal ?? aData.animal;
      animal_id   = a?.id;
      animal_uid  = a?.uid;
      if (!animal_uid && !animal_id) {
        console.error("[/api/book] animal creation failed", aData);
        return NextResponse.json({ error: "Failed to create animal" }, { status: 502 });
      }
    }

    // ── 3. Build startTime ISO string ────────────────────────────────────────
    // Prefer start_iso (already ISO from the slots route),
    // fall back to converting Unix timestamp
    const startTimeISO = start_iso
      ?? (start_time ? new Date(start_time * 1000).toISOString() : null);

    if (!startTimeISO) {
      return NextResponse.json({ error: "start_time or start_iso is required" }, { status: 400 });
    }

    // ── 4. Compute durationMinutes ───────────────────────────────────────────
    let durationMinutes = duration ?? 30;
    if (!duration && start_time && end_time) {
      durationMinutes = Math.round((end_time - start_time) / 60);
    }

    // ── 5. Resolve identifiers — /ezycab/booking needs UIDs not numeric IDs ──
    // If we only have numeric ID, look up the UID
    if (!contact_uid && contact_id) {
      const cRes  = await fetch(`${base}/v2/contact?id=${contact_id}&limit=1`, { headers: authJson });
      const cData = await cRes.json();
      contact_uid = cData.items?.[0]?.contact?.uid;
    }
    if (!animal_uid && animal_id) {
      const aRes  = await fetch(`${base}/v2/animal?id=${animal_id}&limit=1`, { headers: authJson });
      const aData = await aRes.json();
      animal_uid  = aData.items?.[0]?.animal?.uid;
    }

    if (!contact_uid) return NextResponse.json({ error: "Could not resolve contact UID" }, { status: 502 });
    if (!animal_uid)  return NextResponse.json({ error: "Could not resolve animal UID"  }, { status: 502 });

    // ── 6. POST /ezycab/booking ──────────────────────────────────────────────
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

    console.log("[/api/book] payload:", JSON.stringify(bookPayload));

    const bookRes = await fetch(`${BOOKING_BASE}/ezycab/booking`, {
      method: "POST", headers: authJson,
      body: JSON.stringify(bookPayload),
    });

    const bookText = await bookRes.text();
    if (!bookRes.ok) {
      console.error("[/api/book] booking failed:", bookRes.status, bookText);
      return NextResponse.json({ error: "Booking failed", detail: bookText }, { status: 502 });
    }

    const bookData = JSON.parse(bookText);
    const appt     = bookData.data?.[0] ?? bookData.appointment ?? bookData;
    const apptId   = appt?.id ?? appt?.uid;
    const ref      = `NVC-${(apptId ?? Math.random().toString(36).slice(2)).slice(-6).toUpperCase()}`;

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
    console.error("[/api/book]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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