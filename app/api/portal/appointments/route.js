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
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getAppointmentStatusMap } from "@/lib/appointmentStatus";

function mapAppt(i, statusMap) {
  const a = i.appointment ?? i;
  const statusId = a.status_id;
  const durationSeconds = a.duration ?? 0; // ezyVet returns duration in SECONDS
  const refMatch = a.description?.match(/Ref: (NVC-[A-Z0-9]+)/);
  return {
    id:          a.id,
    uid:         a.uid,
    start_time:  a.start_at,                          // ezyVet field is "start_at", not "start_time"
    end_time:    a.start_at ? a.start_at + durationSeconds : null,
    duration_minutes: Math.round(durationSeconds / 60),
    status_id:   statusId,
    status:      statusMap[statusId] ?? "Unknown",
    description: a.description,
    reference:   refMatch ? refMatch[1] : null,  // present only for website bookings
    animal_id:   a.animal_id,
    contact_id:  a.contact_id,
    resource_id: a.resources?.[0]?.id ?? a.sales_resource ?? null,
  };
}

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

    console.log("═══════════════════════════════════════");
    console.log("[/api/portal/appointments] contact_id:", session.contactId);

    const statusMap = await getAppointmentStatusMap(base, headers);

    // ── Strategy 1: direct contact_id filter ───────────────────────────────
    const directUrl = `${base}/v2/appointment?contact_id=${session.contactId}&limit=100`;
    console.log("[/api/portal/appointments] Trying direct filter:", directUrl);
    const directRes  = await fetch(directUrl, { headers });
    const directText = await directRes.text();
    console.log("[/api/portal/appointments] Direct filter status:", directRes.status);

    let appointments = [];

    if (directRes.ok) {
      const directData = JSON.parse(directText);
      appointments = (directData.items ?? []).map(i => mapAppt(i, statusMap));
    }

    // ── Strategy 2: fallback via animal_id ─────────────────────────────────
    if (appointments.length === 0) {
      console.log("[/api/portal/appointments] Direct filter empty — falling back via animal_id");
      const aRes  = await fetch(`${base}/v2/animal?active=1&contact_id=${session.contactId}&limit=50`, { headers });
      const aData = await aRes.json();
      const animalIds = (aData.items ?? []).map(i => (i.animal ?? i).id);

      console.log("[/api/portal/appointments] Animal IDs:", animalIds);

      for (const animalId of animalIds) {
        const apUrl  = `${base}/v2/appointment?animal_id=${animalId}&limit=50`;
        const apRes  = await fetch(apUrl, { headers });
        const apText = await apRes.text();
        if (!apRes.ok) { console.log("[/api/portal/appointments] animal_id filter failed for", animalId, ":", apText); continue; }
        const apData = JSON.parse(apText);
        appointments.push(...(apData.items ?? []).map(i => mapAppt(i, statusMap)));
      }
    }

    // Sort newest-first client-side, since ezyVet's "sort" param isn't accepted here
    appointments.sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));

    // ── Enrich with vet/resource names (batch lookup, one call per unique id) ─
    const uniqueResourceIds = [...new Set(appointments.map(a => a.resource_id).filter(Boolean))];
    const resourceNames = {};
    await Promise.all(uniqueResourceIds.map(async (rid) => {
      try {
        const rRes  = await fetch(`${base}/v2/resource?id=${rid}&limit=1`, { headers });
        const rData = await rRes.json();
        const resource = rData.items?.[0]?.resource ?? rData.resource;
        if (resource) resourceNames[rid] = resource.name;
      } catch (err) {
        console.log("[/api/portal/appointments] resource lookup failed for id", rid, ":", err.message);
      }
    }));
    appointments = appointments.map(a => ({ ...a, resource_name: resourceNames[a.resource_id] ?? null }));

    console.log("[/api/portal/appointments] ✓ Found", appointments.length, "appointments");
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ appointments });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/appointments] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}