// src/app/api/startup/route.js
// GET /api/startup
//
// Called once when the booking page loads.
// Returns everything the UI needs to render branch/service/resource selectors:
//   - site timezone
//   - appointment types (bookable only)
//   - resources grouped by branch/separation
//
// Response shape:
// {
//   site: { id, name, timezone },
//   appointmentTypes: [{ uid, name, duration, isConsultRequired }],
//   resources: [{ uid, name, separationId, separationName }],
// }

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

// Appointment type names that should never appear in the public booking UI.
// Add any "Block Out - Unavailable" or internal types your clinic uses.
const NON_BOOKABLE_KEYWORDS = [
  "block out",
  "unavailable",
  "blocked",
  "internal",
  "staff",
  "lunch",
];

function isBookable(name = "") {
  const lower = name.toLowerCase();
  return !NON_BOOKABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function GET() {
  try {
    const token = await getAccessToken();
    const base  = process.env.EZYVET_BASE_URL;
    const auth  = { Authorization: `Bearer ${token}` };

    // ── Fetch all three in parallel ──────────────────────────────────────────
    const [siteRes, apptTypeRes, resourceRes, separationRes] = await Promise.all([
      fetch(`${base}/v3/siteInformation`, { headers: auth }),
      fetch(`${base}/v2/appointmenttype?active=1&limit=100`, { headers: auth }),
      fetch(`${base}/v2/resource?active=1&access=On+Calendar&limit=100`, { headers: auth }),
      fetch(`${base}/v1/separation?active=1&limit=50`, { headers: auth }),
    ]);

    // ── Site information ─────────────────────────────────────────────────────
    const siteData = await siteRes.json();
    const siteRaw  = siteData.items?.[0]?.siteinformation ?? {};
    const site = {
      id:       siteRaw.id,
      name:     siteRaw.name ?? "Noble Vet Clinics",
      timezone: siteRaw.time_zone ?? "Asia/Dubai",
    };

    // ── Separations (branches/departments) ───────────────────────────────────
    const sepData = await separationRes.json();
    const separationMap = {};
    for (const item of sepData.items ?? []) {
      const sep = item.separation ?? item;
      separationMap[sep.id] = sep.name;
    }

    // ── Appointment types ────────────────────────────────────────────────────
    const apptData = await apptTypeRes.json();
    const appointmentTypes = (apptData.items ?? [])
      .map((i) => i.appointmenttype ?? i)
      .filter((a) => isBookable(a.name))
      .map((a) => ({
        uid:               a.uid,
        name:              a.name,
        duration:          a.length ?? 30,       // minutes
        isConsultRequired: a.is_consult_required ?? true,
      }));

    // ── Resources ────────────────────────────────────────────────────────────
    const resData = await resourceRes.json();
    const resources = (resData.items ?? [])
      .map((i) => i.resource ?? i)
      .map((r) => ({
        uid:            r.uid,
        name:           r.name,
        separationId:   r.ownership_id ?? null,
        separationName: separationMap[r.ownership_id] ?? "Main Clinic",
        type:           r.type_name ?? "vet",
      }));

    // Add CORS header so Framer (noblevetclinic.com) can call this
    const response = NextResponse.json({ site, appointmentTypes, resources });
    response.headers.set(
      "Access-Control-Allow-Origin",
      process.env.ALLOWED_ORIGIN ?? "https://noblevetclinic.com"
    );
    response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return response;

  } catch (err) {
    console.error("[/api/startup]", err);
    return NextResponse.json({ error: "Failed to load clinic configuration" }, { status: 500 });
  }
}

// Handle preflight CORS requests from Framer
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  process.env.ALLOWED_ORIGIN ?? "https://noblevetclinic.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}