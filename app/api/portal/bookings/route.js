// src/app/api/portal/bookings/route.js
// GET — returns only the appointments booked THROUGH THIS WEBSITE
// (identified by the "Ref: NVC-XXXXXX" marker embedded in the description
// at booking time — see book/route.js). This is the subset of "Appointments"
// that the client made themselves online, as distinct from ones booked by
// phone or in-clinic.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getAppointmentStatusMap } from "@/lib/appointmentStatus";

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

    console.log("[/api/portal/bookings] contact_id:", session.contactId);

    const statusMap = await getAppointmentStatusMap(base, headers);

    // Reuse the same animal_id fallback strategy as /api/portal/appointments
    const aRes  = await fetch(`${base}/v2/animal?active=1&contact_id=${session.contactId}&limit=50`, { headers });
    const aData = await aRes.json();
    const animalIds = (aData.items ?? []).map(i => (i.animal ?? i).id);

    let appointments = [];
    for (const animalId of animalIds) {
      const apRes  = await fetch(`${base}/v2/appointment?animal_id=${animalId}&limit=50`, { headers });
      if (!apRes.ok) continue;
      const apData = await apRes.json();
      appointments.push(...(apData.items ?? []).map(i => i.appointment ?? i));
    }

    // Filter to only ones with our booking reference marker
    const websiteBookings = appointments
      .filter(a => a.description?.includes("Ref: NVC-"))
      .map(a => {
        const refMatch = a.description.match(/Ref: (NVC-[A-Z0-9]+)/);
        const statusId = a.appointment_status_id ?? a.status;
        return {
          id:          a.id,
          uid:         a.uid,
          reference:   refMatch ? refMatch[1] : null,
          start_time:  a.start_time,
          end_time:    a.end_time,
          status_id:   statusId,
          status:      statusMap[statusId] ?? "Unknown",
          description: a.description,
          animal_id:   a.animal_id,
        };
      })
      .sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));

    console.log("[/api/portal/bookings] ✓ Found", websiteBookings.length, "website bookings out of", appointments.length, "total");

    const r = NextResponse.json({ bookings: websiteBookings });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/bookings] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}