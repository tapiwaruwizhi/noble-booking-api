
// ═══════════════════════════════════════════════════════════════════════════════
// FILE: src/lib/ezyvet/auth.js
// Token manager — caches the access token in memory, refreshes when expired
// ═══════════════════════════════════════════════════════════════════════════════

let _token = null;
let _expiresAt = 0;

export async function getAccessToken() {
  const now = Date.now();
  if (_token && now < _expiresAt - 60_000) return _token; // 60s buffer

  const res = await fetch(`${process.env.EZYVET_BASE_URL}/v1/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.EZYVET_CLIENT_ID,
      client_secret: process.env.EZYVET_CLIENT_SECRET,
      partner_id:    process.env.EZYVET_PARTNER_ID,
      site_uid:      process.env.EZYVET_SITE_UID,
      grant_type:    "client_credentials",
      scope:         "read-appointment",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ezyVet auth failed: ${res.status} — ${body}`);
  }

  const data = await res.json();
  _token     = data.access_token;
  _expiresAt = now + (data.expires_in ?? 3600) * 1000;
  return _token;
}
