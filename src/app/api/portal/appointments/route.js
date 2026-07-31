// src/app/api/portal/appointments/route.js
// GET — returns all appointments linked to the logged-in contact
// (includes appointments booked by phone/in-clinic, not just via this website).
//
// NOTE: the exact filter param for "appointments belonging to a contact" on
// ezyVet's v2/appointment endpoint hasn't been confirmed against your sandbox
// yet. This tries a direct contact_id filter first, then falls back to
// fetching the contact's animals and filtering appointments by animal_id —
// same defensive multi-strategy pattern used elsewhere in this project.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

function mapAppt(i) {
  const a = i.appointment ?? i;
  return {
    id:          a.id,
    uid:         a.uid,
    start_time:  a.start_time,
    end_time:    a.end_time,
    status:      a.appointment_status_id ?? a.status,
    description: a.description,
    animal_id:   a.animal_id,
    resource_id: a.resource_id ?? a.provider_id,
  };
}

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    console.log("═══════════════════════════════════════");
    console.log("[/api/portal/appointments] contact_id:", session.contactId);

    // ── Strategy 1: direct contact_id filter ───────────────────────────────
    const directUrl = `${base}/v2/appointment?contact_id=${session.contactId}&limit=100&sort=-start_time`;
    console.log("[/api/portal/appointments] Trying direct filter:", directUrl);
    const directRes  = await fetch(directUrl, { headers });
    const directText = await directRes.text();
    console.log("[/api/portal/appointments] Direct filter status:", directRes.status);

    let appointments = [];

    if (directRes.ok) {
      const directData = JSON.parse(directText);
      appointments = (directData.items ?? []).map(mapAppt);
    }

    // ── Strategy 2: fallback via animal_id ─────────────────────────────────
    if (appointments.length === 0) {
      console.log("[/api/portal/appointments] Direct filter empty — falling back via animal_id");
      const aRes  = await fetch(`${base}/v2/animal?active=1&contact_id=${session.contactId}&limit=50`, { headers });
      const aData = await aRes.json();
      const animalIds = (aData.items ?? []).map(i => (i.animal ?? i).id);

      console.log("[/api/portal/appointments] Animal IDs:", animalIds);

      for (const animalId of animalIds) {
        const apUrl  = `${base}/v2/appointment?animal_id=${animalId}&limit=50&sort=-start_time`;
        const apRes  = await fetch(apUrl, { headers });
        const apText = await apRes.text();
        if (!apRes.ok) { console.log("[/api/portal/appointments] animal_id filter failed for", animalId, ":", apText); continue; }
        const apData = JSON.parse(apText);
        appointments.push(...(apData.items ?? []).map(mapAppt));
      }
      appointments.sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));
    }

    console.log("[/api/portal/appointments] ✓ Found", appointments.length, "appointments");
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ appointments });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/portal/appointments] error:", err);
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