// src/app/api/portal/pet-options/route.js
// GET /api/portal/pet-options?species_id=X
//
// Returns the lookup lists needed to build real dropdowns for the pet
// add/edit form. ezyVet's animal create/update endpoints require numeric
// IDs (species_id, breed_id, sex_id, animalcolour_id) — free text is
// rejected with InvalidFieldException. This exposes those lookup tables.
//
// Breeds are filtered by species_id when provided (the breed list is large
// and species-specific — fetching the full list unfiltered isn't useful).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

async function fetchList(base, headers, path, mapFn) {
  try {
    const res  = await fetch(`${base}${path}`, { headers });
    const text = await res.text();
    if (!res.ok) {
      console.log("[/api/portal/pet-options] fetch failed:", path, res.status, text);
      return [];
    }
    const data = JSON.parse(text);
    return (data.items ?? []).map(mapFn).filter(Boolean);
  } catch (err) {
    console.error("[/api/portal/pet-options] error fetching", path, err);
    return [];
  }
}

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const speciesId = new URL(req.url).searchParams.get("species_id");

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    console.log("[/api/portal/pet-options] species_id filter:", speciesId);

    const [species, sexes, colours, breeds] = await Promise.all([
      fetchList(base, headers, "/v1/species?active=1&limit=100", i => {
        const s = i.species ?? i;
        return { id: s.id, name: s.name };
      }),
      fetchList(base, headers, "/v1/sex?active=1&limit=50", i => {
        const s = i.sex ?? i;
        return { id: s.id, name: s.name };
      }),
      fetchList(base, headers, "/v1/animalcolour?active=1&limit=200", i => {
        const c = i.animalcolour ?? i;
        return { id: c.id, name: c.name };
      }),
      speciesId
        ? fetchList(base, headers, `/v1/breed?active=1&limit=500&species_id=${speciesId}`, i => {
            const b = i.breed ?? i;
            return { id: b.id, name: b.name };
          })
        : Promise.resolve([]),
    ]);

    console.log("[/api/portal/pet-options] species:", species.length, "sexes:", sexes.length, "colours:", colours.length, "breeds:", breeds.length);

    const r = NextResponse.json({ species, sexes, colours, breeds });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pet-options] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}