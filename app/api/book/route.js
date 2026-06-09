// src/app/api/startup/route.js
import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS        = process.env.ALLOWED_ORIGIN ?? "*";
const NON_BOOKABLE = ["block out","unavailable","blocked","internal","lunch","zero time","boarding availability","vvn","peerlogic","mri","drug pickup","test postman","google"];
const isBookable  = (name = "") => !NON_BOOKABLE.some(kw => name.toLowerCase().includes(kw));

// ── Branch photos keyed by separationId ──────────────────────────────────────
// Replace URLs with real Noble Vet branch photos.
// These can be Vercel /public/ paths e.g. "/photos/dip.jpg"
// or full URLs e.g. from Cloudinary / Google Drive / your CDN.
const BRANCH_PHOTOS = {
  1:  process.env.BRANCH_PHOTO_1  ?? null,  // API Sandbox → replace with DIP photo
  4:  process.env.BRANCH_PHOTO_1  ?? null,  // Department A → replace with branch photo
  5:  process.env.BRANCH_PHOTO_1  ?? null,  // Department B
  9:  process.env.BRANCH_PHOTO_1  ?? null,  // Department C
  11: process.env.BRANCH_PHOTO_1 ?? null,  // Business unit A
  13: process.env.BRANCH_PHOTO_1 ?? null,  // Business unit B
};

// ── Branch descriptions (shown under name on card) ───────────────────────────
const BRANCH_META = {
  1:  { area: "Dubai",          address: "Dubai Investment Park" },
  4:  { area: "Dubai",          address: "Jumeirah" },
  5:  { area: "Dubai",          address: "JLT" },
  9:  { area: "Dubai",          address: "Sports City" },
  11: { area: "Dubai",          address: "Sustainable City" },
  13: { area: "Dubai",          address: "Downtown Dubai" },
};

export async function GET() {
  try {
    const token = await getAccessToken();
    const base  = process.env.EZYVET_BASE_URL;
    const auth  = { Authorization: `Bearer ${token}` };

    const [siteRes, apptRes, resRes, sepRes] = await Promise.all([
      fetch(`${base}/v3/siteInformation`,                               { headers: auth }),
      fetch(`${base}/v2/appointmenttype?active=1&limit=100`,            { headers: auth }),
      fetch(`${base}/v2/resource?active=1&access=On+Calendar&limit=100`,{ headers: auth }),
      fetch(`${base}/v1/separation?active=1&limit=50`,                  { headers: auth }),
    ]);

    const [siteData, apptData, resData, sepData] = await Promise.all([
      siteRes.json(), apptRes.json(), resRes.json(), sepRes.json()
    ]);

    // Build separation map: id → { name, photo, meta }
    const sepMap = {};
    for (const i of sepData.items ?? []) {
      const s = i.separation ?? i;
      sepMap[s.id] = {
        name:    s.name,
        photo:   BRANCH_PHOTOS[s.id] ?? null,
        area:    BRANCH_META[s.id]?.area    ?? "Dubai",
        address: BRANCH_META[s.id]?.address ?? s.name,
      };
    }

    const siteRaw = siteData.items?.[0]?.siteinformation ?? {};
    const site = {
      id:       siteRaw.id,
      name:     siteRaw.name ?? "Noble Vet Clinics",
      timezone: siteRaw.time_zone ?? "Asia/Dubai",
    };

    const appointmentTypes = (apptData.items ?? [])
      .map(i => i.appointmenttype ?? i)
      .filter(a => isBookable(a.name))
      .map(a => ({
        uid:               a.uid,
        name:              a.name,
        duration:          a.length ?? 30,
        isConsultRequired: a.is_consult_required ?? true,
      }));

    // Deduplicate separations and attach photo + meta
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
          area:    sep.area,
          address: sep.address,
        });
      }
    }

    const resources = (resData.items ?? [])
      .map(i => i.resource ?? i)
      .map(r => ({
        uid:            r.uid,
        name:           r.name,
        separationId:   r.ownership_id ?? null,
        separationName: sepMap[r.ownership_id]?.name ?? "Main Clinic",
        separationPhoto: BRANCH_PHOTOS[r.ownership_id] ?? null,
        type:           r.type_name ?? "vet",
      }));

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