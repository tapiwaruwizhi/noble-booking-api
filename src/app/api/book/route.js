// ═══════════════════════════════════════════════════════════════════════════════
// FILE: src/app/api/book/route.js
// POST /api/book
//
// Body (JSON):
// {
//   email:          "user@example.com",
//   owner_name:     "Sarah Al-Mansoori",      // for new contacts
//   owner_phone:    "+971 50 123 4567",        // for new contacts
//   contact_id:     "contact_123",             // existing contacts only
//   animal_id:      "animal_456",              // existing animals only
//   new_pet: {                                  // new animals only
//     name:    "Luna",
//     species: "Cat",
//     breed:   "British Shorthair"
//   },
//   appt_type_uid:  "appointmentType_xxx",
//   resource_uid:   "resource_xxx",
//   start_time:     1748833200,                // Unix timestamp
//   end_time:       1748836800,
//   description:    "General consultation"
// }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      email, owner_name, owner_phone,
      contact_id: existingContactId,
      animal_id:  existingAnimalId,
      new_pet,
      appt_type_uid, resource_uid,
      start_time, end_time, description,
    } = body;

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const cabBase = process.env.EZYVET_EZYCAB_BASE_URL;
    const headers = {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let contact_id = existingContactId;
    let animal_id  = existingAnimalId;

    // ── 1. Create contact if new ────────────────────────────────────────────
    if (!contact_id) {
      const [firstName, ...rest] = (owner_name ?? "").trim().split(" ");
      const lastName = rest.join(" ") || "-";

      const cRes = await fetch(`${base}/v2/contact`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          first_name: firstName,
          last_name:  lastName,
          email,
          phone:      owner_phone ?? "",
          active:     1,
        }),
      });
      const cData = await cRes.json();
      contact_id  = cData.items?.[0]?.contact?.id ?? cData.contact?.id;

      if (!contact_id) {
        console.error("[/api/book] contact creation failed", cData);
        return NextResponse.json({ error: "Failed to create contact record" }, { status: 502 });
      }
    }

    // ── 2. Create animal if new ─────────────────────────────────────────────
    if (!animal_id && new_pet) {
      const aRes = await fetch(`${base}/v2/animal`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name:       new_pet.name,
          contact_id,
          species:    new_pet.species ?? "Dog",
          breed:      new_pet.breed   ?? "",
          active:     1,
        }),
      });
      const aData = await aRes.json();
      animal_id   = aData.items?.[0]?.animal?.id ?? aData.animal?.id;

      if (!animal_id) {
        console.error("[/api/book] animal creation failed", aData);
        return NextResponse.json({ error: "Failed to create animal record" }, { status: 502 });
      }
    }

    // ── 3. Create booking via /ezycab/booking ───────────────────────────────
    const bookRes = await fetch(`${cabBase}/booking`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        appointment_type_uid: appt_type_uid,
        resource_uid,
        animal_id,
        contact_id,
        start_time,
        end_time,
        description: description ?? "Online booking via Noble Vet website",
      }),
    });

    if (!bookRes.ok) {
      const errBody = await bookRes.text();
      console.error("[/api/book] booking failed:", bookRes.status, errBody);
      return NextResponse.json(
        { error: "Booking failed", detail: errBody },
        { status: 502 }
      );
    }

    const bookData = await bookRes.json();
    const appt     = bookData.appointment ?? bookData.items?.[0]?.appointment;
    const consult  = bookData.consult      ?? bookData.items?.[0]?.consult;

    return NextResponse.json({
      success:         true,
      appointment_uid: appt?.uid,
      consult_id:      consult?.id,
      contact_id,
      animal_id,
      // Reference code shown to client
      reference: `NVC-${(appt?.uid ?? Math.random().toString(36).slice(2,8)).slice(-6).toUpperCase()}`,
    });

  } catch (err) {
    console.error("[/api/book]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


