// src/app/api/booking-lookup/route.js
// GET /api/booking-lookup?ref=NVC-XXXXXX
//
// Looks up an appointment by the reference code embedded in its description
// at booking time (see book/route.js — description gets " | Ref: NVC-XXXXXX"
// appended before the /ezycab/booking call). This makes the reference
// genuinely searchable — both from this endpoint and by staff searching
// directly inside ezyVet's appointment/consult notes.
//
// Two lookup strategies, tried in order:
//   1. Direct filter query (if ezyVet's appointment endpoint accepts a
//      description filter) — fast, single request.
//   2. Fallback: fetch recent appointments and search client-side for the
//      ref substring in the description field — used if (1) is rejected
//      with an InvalidParameterException.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

export async function GET(req) {
  try {
    const ref = new URL(req.url).searchParams.get("ref")?.trim().toUpperCase();
    if (!ref) {
      return NextResponse.json({ error: "ref is required, e.g. ?ref=NVC-JR1ZIP" }, { status: 400 });
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    console.log("═══════════════════════════════════════");
    console.log("[/api/booking-lookup] Looking up ref:", ref);

    // ── Strategy 1: direct filter query ────────────────────────────────────
    const filterUrl = `${base}/v2/appointment?description=${encodeURIComponent(ref)}&limit=5`;
    console.log("[/api/booking-lookup] Trying direct filter:", filterUrl);

    const filterRes  = await fetch(filterUrl, { headers });
    const filterText = await filterRes.text();
    console.log("[/api/booking-lookup] Direct filter status:", filterRes.status);
    console.log("[/api/booking-lookup] Direct filter response:", filterText);

    let match = null;

    if (filterRes.ok) {
      const filterData = JSON.parse(filterText);
      const items = filterData.items ?? [];
      match = items.find(i => (i.appointment ?? i).description?.toUpperCase().includes(ref));
    }

    // ── Strategy 2: fallback — paginate recent appointments, search client-side
    if (!match) {
      console.log("[/api/booking-lookup] Direct filter found nothing — falling back to pagination search");
      let page = 1;
      const limit = 100;
      outer: while (page <= 5) { // cap at 500 recent appointments
        const pgUrl = `${base}/v2/appointment?limit=${limit}&page=${page}&sort=-created_at`;
        console.log("[/api/booking-lookup] Fetching page", page, ":", pgUrl);
        const pgRes  = await fetch(pgUrl, { headers });
        const pgText = await pgRes.text();
        console.log("[/api/booking-lookup] Page", page, "status:", pgRes.status);
        if (!pgRes.ok) { console.log("[/api/booking-lookup] Page fetch failed, stopping fallback"); break; }

        const pgData = JSON.parse(pgText);
        const items  = pgData.items ?? [];
        if (items.length === 0) break;

        for (const i of items) {
          const a = i.appointment ?? i;
          if (a.description?.toUpperCase().includes(ref)) {
            match = i;
            console.log("[/api/booking-lookup] ✓ Found match on page", page, "— appointment id:", a.id);
            break outer;
          }
        }
        if (items.length < limit) break;
        page++;
      }
    }

    if (!match) {
      console.log("[/api/booking-lookup] ✗ No appointment found for ref:", ref);
      console.log("═══════════════════════════════════════");
      const r = NextResponse.json({ found: false, reference: ref });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    const appt = match.appointment ?? match;
    console.log("[/api/booking-lookup] ✓ Match:", JSON.stringify(appt));
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({
      found: true,
      reference: ref,
      appointment: {
        id:          appt.id,
        uid:         appt.uid,
        start_time:  appt.start_time,
        end_time:    appt.end_time,
        status:      appt.appointment_status_id ?? appt.status,
        description: appt.description,
        contact_id:  appt.contact_id,
        animal_id:   appt.animal_id,
        resource_id: appt.resource_id ?? appt.provider_id,
      },
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/booking-lookup] UNCAUGHT ERROR:", err);
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