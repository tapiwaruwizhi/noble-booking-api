// src/app/api/portal/pet-consults/route.js
// GET ?animal_id=X — returns consult history for a pet.
//
// Used for the pets tab's "SOC events" section. NOTE: "SOC" isn't a
// recognized field on ezyVet's animal/consult schema — this returns the
// animal's consult record dates/notes as the closest available real data.
// Confirm with the team what "SOC events" specifically refers to and this
// can be adjusted to pull the correct data source.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function GET(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const animalId = new URL(req.url).searchParams.get("animal_id");
    if (!animalId) {
      const r = NextResponse.json({ error: "animal_id is required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── Ownership check ───────────────────────────────────────────────────
    const checkRes  = await fetch(`${base}/v2/animal?id=${animalId}&limit=1`, { headers });
    const checkData = await checkRes.json();
    const existing  = checkData.items?.[0]?.animal ?? checkData.animal;
    if (!existing || String(existing.contact_id) !== String(session.contactId)) {
      console.warn("[/api/portal/pet-consults] Ownership check failed for animal_id:", animalId);
      const r = NextResponse.json({ error: "Pet not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    console.log("[/api/portal/pet-consults] Fetching consults for animal_id:", animalId);

    const cRes  = await fetch(`${base}/v2/consult?animal_id=${animalId}&limit=25`, { headers });
    const cText = await cRes.text();
    console.log("[/api/portal/pet-consults] status:", cRes.status);

    let consults = [];
    if (cRes.ok) {
      const cData = JSON.parse(cText);
      consults = (cData.items ?? []).map(i => {
        const c = i.consult ?? i;
        return {
          id:      c.id,
          date:    c.date ?? c.created_at ?? null,
          notes:   c.notes ?? c.description ?? null,
        };
      }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    } else {
      console.log("[/api/portal/pet-consults] fetch failed:", cText);
    }

    const r = NextResponse.json({ consults });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pet-consults] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}