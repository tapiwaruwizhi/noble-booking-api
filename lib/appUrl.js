// lib/appUrl.js
//
// Where "here" and "the portal" are.
//
// `getApiOrigin(req)` — the origin the signup link should point at. Order:
//   1. PUBLIC_API_URL       — set this in Vercel if you want it pinned.
//   2. VERCEL_PROJECT_PRODUCTION_URL — injected by Vercel; means a link emailed
//      from a preview deployment still lands on production, which is what you
//      want (preview URLs die).
//   3. The request's own origin — correct locally, and a sane last resort.
//
// `getPortalUrl()` — where "Continue to your account" goes after signing up.
// The portal itself is the Framer site, NOT this API domain, so it can't be
// derived from the request. Set PORTAL_URL in Vercel; the default is the
// public site.

export function getApiOrigin(req) {
  const pinned = process.env.PUBLIC_API_URL;
  if (pinned) return pinned.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

export function getPortalUrl() {
  return (process.env.PORTAL_URL || "https://noblevetclinic.com").replace(/\/+$/, "");
}
