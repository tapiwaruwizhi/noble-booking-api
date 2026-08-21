
// src/app/api/portal/standard-of-care/route.js
// GET — returns the Standard of Care (SOC) schedule for every animal belonging
// to the logged-in contact: what's due, when, and when it was last done.
//
// ── What SOC is ────────────────────────────────────────────────────────────
// Per ezyVet's own docs, a Standard of Care is "a list of treatments and
// vaccinations that a pet should be receiving on a regular basis in order to
// maintain its baseline health". This is almost certainly what the original
// "SOC events" requirement meant — it had previously been implemented as the
// animal's consult history, which is a different thing entirely.
//   https://developers.ezyvet.com/guides/soc.html
//
// ── Field names ────────────────────────────────────────────────────────────
// Unusually for this project, these ARE documented rather than guessed:
//   due_at, last_fulfilled_at, animal_id, animal_uid,
//   soc_group_name, soc_group_type ("Treatment" | "Vaccine"), modified_at
// Shape logging is still on for the first deploy, since the docs describe
// v2 and this instance may differ.
//
// Requires the `read-standardofcare` scope (added to lib/ezyvet/auth.js).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getContactAnimals } from "@/lib/portalAnimals";
import { logRecordShape, unwrap, pick, toEpochSeconds } from "@/lib/ezyvet/shape";

const DAY = 86_400;

/**
 * Buckets an item by how overdue / close to due it is.
 * "due_soon" is a 30-day window — long enough that a client can realistically
 * book something before it lapses.
 */
function statusFor(dueAt, nowSec) {
  if (!dueAt) return "unscheduled";
  if (dueAt < nowSec) return "overdue";
  if (dueAt - nowSec <= 30 * DAY) return "due_soon";
  return "ok";
}

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

    console.log("═══════════════════════════════════════");
    console.log("[/api/portal/standard-of-care] contact_id:", session.contactId);

    // ── Ownership: only ever query animals that belong to this contact ──────
    const animals = await getContactAnimals(base, headers, session.contactId);
    if (animals.length === 0) {
      console.log("[/api/portal/standard-of-care] no animals on file — returning empty");
      const r = NextResponse.json({ items: [], by_animal: {}, scope_ok: true });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    let scopeOk = true;   // flips false on 401/403 → almost always a missing scope
    let profiled = false;
    const items = [];

    await Promise.all(animals.map(async (animal) => {
      const url = `${base}/v2/standardofcare?animal_id=${animal.id}&limit=200`;
      try {
        const res  = await fetch(url, { headers });
        const text = await res.text();

        if (!res.ok) {
          // 401/403 here almost always means `read-standardofcare` isn't granted
          // on this API partner/site config, even though the token issued fine.
          if (res.status === 401 || res.status === 403) scopeOk = false;
          console.log(`[/api/portal/standard-of-care] animal ${animal.id} failed:`, res.status, text.slice(0, 300));
          return;
        }

        const data = JSON.parse(text);
        const rows = data.items ?? [];

        if (!profiled && rows.length) {
          profiled = true;
          logRecordShape("/api/portal/standard-of-care", unwrap(rows[0], "standardofcare"));
        }

        for (const row of rows) {
          const soc = unwrap(row, "standardofcare");
          items.push({
            animal_id:         animal.id,
            animal_name:       animal.name,
            name:              pick(soc, ["soc_group_name", "name"], "Care item"),
            // "Vaccine" | "Treatment" per the docs; normalised lowercase so the
            // frontend can filter without worrying about casing drift.
            type:              String(pick(soc, ["soc_group_type", "type"], "")).toLowerCase(),
            due_at:            toEpochSeconds(pick(soc, ["due_at", "due_date"])),
            last_fulfilled_at: toEpochSeconds(pick(soc, ["last_fulfilled_at", "last_fulfilled", "fulfilled_at"])),
          });
        }
      } catch (err) {
        console.log(`[/api/portal/standard-of-care] animal ${animal.id} threw:`, err.message);
      }
    }));

    const nowSec = Math.floor(Date.now() / 1000);
    for (const it of items) it.status = statusFor(it.due_at, nowSec);

    // Soonest-due first; unscheduled items sink to the bottom.
    items.sort((a, b) => (a.due_at ?? Infinity) - (b.due_at ?? Infinity));

    // Pre-grouped per animal so the frontend doesn't have to filter repeatedly
    // (the pet cards need a per-animal roll-up on every render).
    const byAnimal = {};
    for (const animal of animals) {
      const mine = items.filter((i) => i.animal_id === animal.id);
      const overdue  = mine.filter((i) => i.status === "overdue");
      const dueSoon  = mine.filter((i) => i.status === "due_soon");
      byAnimal[animal.id] = {
        animal_name: animal.name,
        items: mine,
        overdue_count: overdue.length,
        due_soon_count: dueSoon.length,
        // A single line the pet cards can render as-is, e.g. "Worming due".
        // Null when nothing is outstanding — the UI shows "Up to date" then.
        headline: overdue.length
          ? `${overdue[0].name} overdue`
          : dueSoon.length
            ? `${dueSoon[0].name} due`
            : null,
      };
    }

    console.log("[/api/portal/standard-of-care] ✓", items.length, "items across", animals.length, "animals | scope_ok:", scopeOk);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({ items, by_animal: byAnimal, scope_ok: scopeOk });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/standard-of-care] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}