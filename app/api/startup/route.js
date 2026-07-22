// src/app/api/startup/route.js
// GET /api/startup
// Fetches site info, appointment types, resources and separations.
// Branch photos from noblevetclinic.com Framer CDN.
// ezyVet separation names are kept as-is.
// displayName = "Real Branch (ezyVet name)" e.g. "Jumeirah (Department A)"

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { list } from "@vercel/blob";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

const NON_BOOKABLE = [
  "block out", "unavailable", "blocked", "internal", "lunch",
  "zero time", "boarding availability", "vvn", "peerlogic",
  "mri", "drug pickup", "test postman", "google",
];
const isBookable = (name = "") =>
  !NON_BOOKABLE.some((kw) => name.toLowerCase().includes(kw));

// ── Branch map keyed by separation ID ────────────────────────────────────────
// realName = Noble Vet's public branch name (shown in UI prefix)
// ezyVet separation name is kept and shown in brackets after e.g. "(Department A)"
const BRANCH_MAP = {
  1:  {
    realName: "Dubai Investment Park (DIP)",
    photo:    "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:  "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:    "8am – 9pm daily",
  },
  4:  {
    realName: "Jumeirah",
    photo:    "https://framerusercontent.com/images/lqrR41VkWauKj02z17JplcKOs.webp?width=800",
    address:  "Villa 63 Umm Al Sheif St, Jumeirah 3, Dubai",
    hours:    "Mon–Fri 8am–8pm · Sat–Sun 9am–6pm",
  },
  5:  {
    realName: "Jumeirah Lake Towers (JLT)",
    photo:    "https://framerusercontent.com/images/hPLBXv621QKLaSk5kWzR88tvB9k.webp?width=800",
    address:  "Retail R3A, Lake Point Tower, Cluster N, JLT",
    hours:    "10am – 7pm daily",
  },
  9:  {
    realName: "Sports City",
    photo:    "https://framerusercontent.com/images/TV5pz7Ult5uD58sxDq18jVWDDI.webp?width=800",
    address:  "Shop 1, Canal Residence West, Dubai Sports City",
    hours:    "Call for hours",
  },
  11: {
    realName: "Sustainable City",
    photo:    "https://framerusercontent.com/images/Om0XtUe6bUMiRMKb0bfUkXGPjCo.webp?width=800",
    address:  "Sustainable City Plaza, Off Al Qudra Rd, Dubailand",
    hours:    "Call for hours",
  },
  13: {
    realName: "Dubai Investment Park (DIP)",
    photo:    "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:  "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:    "8am – 9pm daily",
  },
  // Add production separation IDs here when going live
};

const FALLBACK_BRANCH = {
  realName: null,
  photo:    null, // replaced by Vercel Blob "locations/default.jpg" at runtime — see getBlobOverrides
  address:  "Dubai, UAE",
  hours:    "Call +971 600 566 253",
};

function getBranch(id) {
  return BRANCH_MAP[id] ?? FALLBACK_BRANCH;
}

// Format display name: "Jumeirah (Department A)" or just ezyVet name if no mapping
function getDisplayName(realName, ezyvetName) {
  if (!realName) return ezyvetName;
  if (realName === ezyvetName) return realName;
  return `${realName} (${ezyvetName})`;
}

const VET_PHOTOS = {
  "dr. lidija krvavac":     "https://framerusercontent.com/assets/N2wbokBOHicxdBZjOvaeeEslew.jpg",
};

function getVetPhoto(name = "") {
  const key = name.toLowerCase().trim();
  if (VET_PHOTOS[key]) return VET_PHOTOS[key];
  for (const [k, url] of Object.entries(VET_PHOTOS)) {
    const lastName = k.split(" ").slice(-1)[0];
    if (key.includes(lastName)) return url;
  }
  return null;
}

// ── Vercel Blob overrides ────────────────────────────────────────────────────
// Admin-uploaded images (via /admin/images) take priority over hardcoded
// CDN/VET_PHOTOS fallbacks. Blob paths follow: locations/{id}.ext, doctors/{uid}.ext
async function getBlobOverrides(prefix) {
  try {
    const { blobs } = await list({ prefix: `${prefix}/`, limit: 200 });
    const map = {};
    for (const b of blobs) {
      // e.g. "locations/4.jpg" → key "4"
      const filename = b.pathname.split("/").pop();
      const key      = filename.replace(/\.[^.]+$/, "");
      map[key] = b.url;
    }
    return map;
  } catch (err) {
    console.error(`[/api/startup] Blob list failed for prefix "${prefix}":`, err.message);
    return {};
  }
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

    // ── Vercel Blob overrides (admin-uploaded images) ──────────────────────────
    const [locationOverrides, doctorOverrides, serviceOverrides] = await Promise.all([
      getBlobOverrides("locations"),
      getBlobOverrides("doctors"),
      getBlobOverrides("services"),
    ]);

    // ── Site ──────────────────────────────────────────────────────────────────
    const siteRaw = siteData.items?.[0]?.siteinformation ?? {};
    const site = {
      id:       siteRaw.id,
      name:     siteRaw.name ?? "Noble Vet Clinics",
      timezone: siteRaw.time_zone ?? "Asia/Dubai",
    };

    // ── Separation map ────────────────────────────────────────────────────────
    // Keeps ezyVet name, adds realName and displayName
    const sepMap = {};
    for (const i of sepData.items ?? []) {
      const s      = i.separation ?? i;
      const branch = getBranch(s.id);
      const ezyvetName = s.name;
      sepMap[s.id] = {
        ezyvetName,
        realName:    branch.realName,
        displayName: getDisplayName(branch.realName, ezyvetName),
        photo:       locationOverrides[s.id] ?? branch.photo ?? locationOverrides["default"] ?? null,
        address:     branch.address,
        hours:       branch.hours,
      };
    }

    // ── Appointment types ─────────────────────────────────────────────────────
    const appointmentTypes = (apptData.items ?? [])
      .map((i) => i.appointmenttype ?? i)
      .filter((a) => isBookable(a.name))
      .map((a) => ({
        uid:               a.uid,
        name:              a.name,
        photo:             serviceOverrides[a.uid] ?? serviceOverrides["default"] ?? null,
        duration:          15,
        isConsultRequired: a.is_consult_required ?? true,
      }));

    // ── Resources ─────────────────────────────────────────────────────────────
    const resources = (resData.items ?? [])
      .map((i) => i.resource ?? i)
      .map((r) => {
        const sep = sepMap[r.ownership_id] ?? {};
        return {
          uid:                r.uid,
          name:               r.name,
          photo:              doctorOverrides[r.uid] ?? getVetPhoto(r.name) ?? doctorOverrides["default"] ?? null,
          separationId:       r.ownership_id ?? null,
          separationName:     sep.displayName ?? sep.ezyvetName ?? "Main Clinic",
          separationEzyName:  sep.ezyvetName  ?? "Main Clinic",
          separationRealName: sep.realName    ?? null,
          separationPhoto:    sep.photo       ?? locationOverrides["default"] ?? null,
          separationAddress:  sep.address     ?? "Dubai, UAE",
          separationHours:    sep.hours       ?? "Call for hours",
          type:               r.type_name     ?? "vet",
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
          id:          r.ownership_id,
          name:        sep.displayName,   // "Jumeirah (Department A)"
          ezyvetName:  sep.ezyvetName,    // "Department A"
          realName:    sep.realName,      // "Jumeirah"
          photo:       sep.photo,
          address:     sep.address,
          hours:       sep.hours,
        });
      }
    }

    const response = NextResponse.json({ site, appointmentTypes, resources, separations });
    response.headers.set("Access-Control-Allow-Origin", CORS);
    response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return response;

  } catch (err) {
    console.error("[/api/startup]", err);
    return NextResponse.json({ error: "Failed to load clinic configuration" }, { status: 500 });
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