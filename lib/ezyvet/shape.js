// src/lib/ezyvet/shape.js
//
// Small helpers for working with ezyVet resources whose field names we haven't
// confirmed against live data yet.
//
// Context: this project has repeatedly been bitten by assuming field names
// (see the animal `species_name` bug — the field simply doesn't exist, and the
// UI silently rendered blanks for weeks). The rule learned the hard way is
// "never assume a field name, always confirm against live data". These helpers
// make that confirmation a one-deploy job instead of a guessing loop.

/**
 * Logs the key set + a truncated sample of the first record returned by a
 * resource, so the exact shape can be read straight out of the Vercel logs
 * after a single request. Deliberately noisy — the whole point is to make an
 * unconfirmed shape self-documenting the first time it's hit in production.
 *
 * Remove (or drop to a debug flag) once a resource's shape is confirmed and
 * written into the project context doc.
 */
export function logRecordShape(label, sample) {
  if (!sample || typeof sample !== "object") {
    console.log(`[${label}] SHAPE — no records returned, nothing to profile`);
    return;
  }
  console.log(`[${label}] SHAPE — keys:`, JSON.stringify(Object.keys(sample)));
  console.log(`[${label}] SHAPE — sample:`, JSON.stringify(sample).slice(0, 1500));
}

/**
 * ezyVet wraps list items inconsistently: sometimes `{ items: [{ invoice: {...} }] }`,
 * sometimes `{ items: [{...}] }`. Unwraps a named envelope if present.
 */
export function unwrap(item, key) {
  if (!item || typeof item !== "object") return item;
  return item[key] ?? item;
}

/**
 * Returns the first candidate field that is actually present (not undefined/null).
 * Use for resources whose field name isn't confirmed — pass the likely names in
 * order of confidence.
 *
 *   pick(inv, ["total", "amount", "invoice_total"])
 */
export function pick(obj, candidates, fallback = null) {
  if (!obj) return fallback;
  for (const key of candidates) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

/** `pick` coerced to a finite number, else the fallback (default 0). */
export function pickNumber(obj, candidates, fallback = 0) {
  const raw = pick(obj, candidates, null);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalises the many shapes ezyVet uses for timestamps into epoch SECONDS
 * (the unit the rest of this project standardised on — see `start_at` on
 * appointments). Handles epoch seconds, epoch milliseconds, and ISO strings.
 */
export function toEpochSeconds(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    // Anything past ~year 2286 in seconds is almost certainly milliseconds.
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const asNum = Number(value);
  if (Number.isFinite(asNum) && String(value).trim() !== "") {
    return asNum > 10_000_000_000 ? Math.floor(asNum / 1000) : Math.floor(asNum);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}