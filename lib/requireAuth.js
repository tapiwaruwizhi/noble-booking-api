// src/lib/requireAuth.js
//
// Shared helper for portal API routes — resolves the caller's session.
//
// Accepts the session token from EITHER of two places:
//
//   1. `Authorization: Bearer <token>`  — used by the React Native app.
//      Native apps have no browser cookie jar, and the web portal's cookie is
//      `sameSite: "none"` + httpOnly, which doesn't carry over cleanly to
//      iOS/Android networking. Mobile stores the token in expo-secure-store and
//      sends it explicitly instead.
//
//   2. The `nvc_session` cookie — used by the web portal, unchanged.
//
// It's the SAME token in both cases: `createSessionToken()` produces a
// self-contained HMAC-signed string, so nothing extra is needed server-side to
// support bearer auth — no separate token type, no new secret, no extra store.
// Bearer is checked first so an explicit header always wins over a stale cookie.

import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

/** Pulls a bearer token out of the Authorization header, if present. */
function getBearerToken(req) {
  const header = req.headers?.get?.("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export function getSession(req) {
  const token = getBearerToken(req) ?? req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}