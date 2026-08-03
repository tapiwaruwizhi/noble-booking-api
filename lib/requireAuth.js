// src/lib/requireAuth.js
//
// Shared helper for portal API routes — reads and verifies the session
// cookie from an incoming request. Returns the session payload or null.

import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

export function getSession(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}