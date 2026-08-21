// src/app/api/portal/vaccinations/route.js
// GET [?animal_id=X] — vaccination records actually administered, per animal,
// for the logged-in contact.
//
// ── How this differs from /api/portal/standard-of-care ─────────────────────
// SOC answers "what is DUE and when" (forward-looking schedule).
// This answers "what was GIVEN, when, and with what" (backward-looking history).
// The pet profile uses both: SOC drives the due/overdue panel, this drives the
// vaccination history list.
//
// ── Field names are NOT confirmed ──────────────────────────────────────────
// ezyVet documents `GET /v1/vaccination` but this project has no live sample of
// its response yet. Per the rule learned the hard way on animal.species_name —
// never assume — every field is read through `pick()` with ordered candidates,
// and the first record's real shape is logged on each deploy so this can be
// tightened to the actual names after one request. See lib/ezyvet/shape.js.
//
// Requires the `read-vaccination` scope (added to lib/ezyvet/auth.js).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getContactAnimals } from "@/lib/portalAnimals";
import { logRecordShape, unwrap, pick, toEpochSeconds } from "@/lib/ezyvet/shape";

export async function GET(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    const requestedAnimalId = new URL(req.url).searchParams.get("animal_id");

    console.log("═══════════════════════════════════════");
    console.log("[/api/portal/vaccinations] contact_id:", session.contactId, "| animal_id filter:", requestedAnimalId ?? "(all)");

    // ── Ownership ───────────────────────────────────────────────────────────
    // Always resolve the contact's own animals first, then intersect with the
    // requested id. A client must never be able to read another client's
    // records by passing an arbitrary animal_id.
    const owned = await getContactAnimals(base, headers, session.contactId);
    const animals = requestedAnimalId
      ? owned.filter((a) => String(a.id) === String(requestedAnimalId))
      : owned;

    if (requestedAnimalId && animals.length === 0) {
      console.warn("[/api/portal/vaccinations] ownership check failed for animal_id:", requestedAnimalId);
      const r = NextResponse.json({ error: "Animal not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    let scopeOk = true;
    let profiled = false;
    const items = [];

    await Promise.all(animals.map(async (animal) => {
      const url = `${base}/v1/vaccination?animal_id=${animal.id}&limit=200`;
      try {
        const res  = await fetch(url, { headers });
        const text = await res.text();

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) scopeOk = false;
          console.log(`[/api/portal/vaccinations] animal ${animal.id} failed:`, res.status, text.slice(0, 300));
          return;
        }

        const data = JSON.parse(text);
        const rows = data.items ?? [];

        if (!profiled && rows.length) {
          profiled = true;
          logRecordShape("/api/portal/vaccinations", unwrap(rows[0], "vaccination"));
        }

        for (const row of rows) {
          const v = unwrap(row, "vaccination");
          items.push({
            id:         pick(v, ["id"]),
            animal_id:  animal.id,
            animal_name: animal.name,
            // Product/vaccine name — candidate list ordered by how likely each
            // is given ezyVet's naming elsewhere in the API.
            name:       pick(v, ["name", "vaccine_name", "product_name", "description", "type_name"], "Vaccination"),
            given_at:   toEpochSeconds(pick(v, ["administered_at", "date_administered", "given_at", "vaccination_date", "date", "created_at"])),
            due_at:     toEpochSeconds(pick(v, ["due_at", "next_due_at", "due_date", "expires_at"])),
            batch:      pick(v, ["batch_number", "batch", "serial_number", "lot_number"]),
            site:       pick(v, ["site", "administration_site", "location"]),
            vet:        pick(v, ["administered_by", "user_name", "vet_name"]),
          });
        }
      } catch (err) {
        console.log(`[/api/portal/vaccinations] animal ${animal.id} threw:`, err.message);
      }
    }));

    // Most recently administered first; undated records sink to the bottom.
    items.sort((a, b) => (b.given_at ?? 0) - (a.given_at ?? 0));

    const byAnimal = {};
    for (const animal of animals) {
      byAnimal[animal.id] = items.filter((i) => i.animal_id === animal.id);
    }

    console.log("[/api/portal/vaccinations] ✓", items.length, "records across", animals.length, "animals | scope_ok:", scopeOk);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ items, by_animal: byAnimal, scope_ok: scopeOk });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/vaccinations] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}
