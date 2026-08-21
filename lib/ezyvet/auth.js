// ═══════════════════════════════════════════════════════════════════════════════
// FILE: src/lib/ezyvet/auth.js
// Token manager — caches the access token in memory, refreshes when expired
// ═══════════════════════════════════════════════════════════════════════════════

// OAuth scopes requested for the client-credentials token.
//
// Kept as a list (not one long string) so adding a scope is a one-line diff —
// ezyVet returns a token happily even if a scope is missing, and the failure
// only shows up later as a 403 on the endpoint you actually needed, so it's
// worth being able to see at a glance what's granted.
//
// Ordered alphabetically within the read- / write- groups.
const SCOPES = [
  // ── read ──────────────────────────────────────────────────────────────
  "read-address",
  "read-animal",
  "read-animalcolour",
  "read-appointment",
  "read-appointmentstatus",
  "read-appointmenttype",
  "read-attachment",
  "read-breed",
  "read-communication",
  "read-consult",
  "read-contact",
  "read-contactassociation",
  "read-contactdetail",
  "read-contactdetailtype",
  "read-country",
  "read-eventgroup",
  "read-history",         // clinical history entries
  "read-invoice",         // backs /api/portal/financials
  "read-resource",
  "read-separation",
  "read-sex",
  "read-species",
  "read-standardofcare",  // "SOC events" — the per-animal care plan/schedule
  "read-tag",
  "read-tagcategory",
  "read-tagname",
  "read-user",
  "read-vaccination",     // backs the pet-profile vaccination panel
  "read-webhookevents",
  "read-webhooks",
  // ── write ─────────────────────────────────────────────────────────────
  "write-address",
  "write-animal",
  "write-appointment",
  "write-attachment",
  "write-communication",
  "write-contact",
  "write-contactdetail",
  "write-userprofile",
  "write-webhooks",
  "create-booking",
];

let _token = null;
let _expiresAt = 0;

export async function getAccessToken() {
  const now = Date.now();
  if (_token && now < _expiresAt - 60_000) return _token;

  const url = `${process.env.EZYVET_BASE_URL}/v2/oauth/access_token`;
  console.log("AUTH URL:", url); // ← add this

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.EZYVET_CLIENT_ID,
      client_secret: process.env.EZYVET_CLIENT_SECRET,
      partner_id:    process.env.EZYVET_PARTNER_ID,
      site_uid:      process.env.EZYVET_SITE_UID,
      grant_type:    "client_credentials",
      scope:         SCOPES.join(","),
    }),
  });

  const text = await res.text(); // ← read as text first
  console.log("AUTH STATUS:", res.status);
  console.log("AUTH RESPONSE:", text.slice(0, 200)); // ← first 200 chars

  if (!res.ok) {
    throw new Error(`ezyVet auth failed: ${res.status} — ${text}`);
  }

  try {
    const data  = JSON.parse(text);
    _token      = data.access_token;
    _expiresAt  = now + (data.expires_in ?? 3600) * 1000;
    return _token;
  } catch {
    throw new Error(`ezyVet auth returned non-JSON: ${text.slice(0, 300)}`);
  }
}