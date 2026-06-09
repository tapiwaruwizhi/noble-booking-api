// src/app/api/startup/route.js
// GET /api/startup
// Fetches site info, appointment types, resources and separations.
// Branch photos pulled directly from noblevetclinic.com Framer CDN.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

const NON_BOOKABLE = [
  "block out", "unavailable", "blocked", "internal", "lunch",
  "zero time", "boarding availability", "vvn", "peerlogic",
  "mri", "drug pickup", "test postman", "google",
];
const isBookable = (name = "") =>
  !NON_BOOKABLE.some((kw) => name.toLowerCase().includes(kw));

// ── Branch map keyed by separation ID ────────────────────────────────────────
// Covers both sandbox IDs and production IDs.
// Update separation IDs when switching from sandbox to production.
// Photos sourced directly from noblevetclinic.com (Framer CDN — no upload needed).
const BRANCH_MAP = {
  // ── Sandbox IDs (mapped to real Noble Vet branches for testing) ───────────
  1:  {
    name:    "Dubai Investment Park (DIP)",
    photo:   "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address: "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:   "8am – 9pm daily",
  },
  4:  {
    name:    "Jumeirah",
    photo:   "https://framerusercontent.com/images/lqrR41VkWauKj02z17JplcKOs.webp?width=800",
    address: "Villa 63 Umm Al Sheif St, Jumeirah 3, Dubai",
    hours:   "Mon–Fri 8am–8pm · Sat–Sun 9am–6pm",
  },
  5:  {
    name:    "Jumeirah Lake Towers (JLT)",
    photo:   "https://framerusercontent.com/images/hPLBXv621QKLaSk5kWzR88tvB9k.webp?width=800",
    address: "Retail R3A, Lake Point Tower, Cluster N, JLT",
    hours:   "10am – 7pm daily",
  },
  9:  {
    name:    "Sports City",
    photo:   "https://framerusercontent.com/images/TV5pz7Ult5uD58sxDq18jVWDDI.webp?width=800",
    address: "Shop 1, Canal Residence West, Dubai Sports City",
    hours:   "Call for hours",
  },
  11: {
    name:    "Sustainable City",
    photo:   "https://framerusercontent.com/images/Om0XtUe6bUMiRMKb0bfUkXGPjCo.webp?width=800",
    address: "Sustainable City Plaza, Off Al Qudra Rd, Dubailand",
    hours:   "Call for hours",
  },
  13: {
    name:    "Dubai Investment Park (DIP)",
    photo:   "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address: "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:   "8am – 9pm daily",
  },
  // ── Add production separation IDs here when going live ────────────────────
  // e.g. 42: { name: "Jumeirah", photo: "...", address: "...", hours: "..." },
};

const FALLBACK_BRANCH = {
  name:    "Noble Vet Clinics",
  photo:   "https://framerusercontent.com/images/04p16NKQdQElKK3AUH9nMUopoI4.jpg",
  address: "Dubai, UAE",
  hours:   "Call +971 600 566 253",
};
 
function getBranch(id) {
  return BRANCH_MAP[id] ?? FALLBACK_BRANCH;
}

export async function GET() {
  try {
    const token = await getAccessToken();
    const base  = process.env.EZYVET_BASE_URL;
    const auth  = { Authorization: `Bearer ${token}` };

    const [siteRes, apptRes, resRes, sepRes] = await Promise.all([
      fetch(`${base}/v3/siteInformation`,                                { headers: auth }),
      fetch(`${base}/v2/appointmenttype?active=1&limit=100`,             { headers: auth }),
      fetch(`${base}/v2/resource?active=1&access=On+Calendar&limit=100`, { headers: auth }),
      fetch(`${base}/v1/separation?active=1&limit=50`,                   { headers: auth }),
    ]);

    const [siteData, apptData, resData, sepData] = await Promise.all([
      siteRes.json(), apptRes.json(), resRes.json(), sepRes.json(),
    ]);

    // ── Site ──────────────────────────────────────────────────────────────────
    const siteRaw = siteData.items?.[0]?.siteinformation ?? {};
    const site = {
      id:       siteRaw.id,
      name:     siteRaw.name ?? "Noble Vet Clinics",
      timezone: siteRaw.time_zone ?? "Asia/Dubai",
    };

    // ── Separation map ────────────────────────────────────────────────────────
    const sepMap = {};
    for (const i of sepData.items ?? []) {
      const s      = i.separation ?? i;
      const branch = getBranch(s.id);
      sepMap[s.id] = {
        name:    branch.name,    // override sandbox name with real branch name
        photo:   branch.photo,
        address: branch.address,
        hours:   branch.hours,
      };
    }

    // ── Appointment types ─────────────────────────────────────────────────────
    const appointmentTypes = (apptData.items ?? [])
      .map((i) => i.appointmenttype ?? i)
      .filter((a) => isBookable(a.name))
      .map((a) => ({
        uid:               a.uid,
        name:              a.name,
        duration:          a.length ?? 30,
        isConsultRequired: a.is_consult_required ?? true,
      }));

    // ── Resources ─────────────────────────────────────────────────────────────
    const resources = (resData.items ?? [])
      .map((i) => i.resource ?? i)
      .map((r) => {
        const sep = sepMap[r.ownership_id] ?? {};
        return {
          uid:             r.uid,
          name:            r.name,
          separationId:    r.ownership_id ?? null,
          separationName:  sep.name  ?? "Main Clinic",
          separationPhoto: sep.photo ?? FALLBACK_BRANCH.photo,
          separationAddress: sep.address ?? "Dubai, UAE",
          separationHours:   sep.hours   ?? "Call for hours",
          type:            r.type_name ?? "vet",
        };
      });

    // ── Deduplicated separations list (for branch cards) ──────────────────────
    const seenSeps = new Set();
    const separations = [];
    for (const i of resData.items ?? []) {
      const r = i.resource ?? i;
      if (!r.ownership_id || seenSeps.has(r.ownership_id)) continue;
      seenSeps.add(r.ownership_id);
      const sep = sepMap[r.ownership_id];
      if (sep) {
        separations.push({
          id:      r.ownership_id,
          name:    sep.name,
          photo:   sep.photo,
          address: sep.address,
          hours:   sep.hours,
        });
      }
    }

    const response = NextResponse.json({
      site,
      appointmentTypes,
      resources,
      separations,
    });
    response.headers.set("Access-Control-Allow-Origin", CORS);
    response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return response;

  } catch (err) {
    console.error("[/api/startup]", err);
    return NextResponse.json(
      { error: "Failed to load clinic configuration" },
      { status: 500 }
    );
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