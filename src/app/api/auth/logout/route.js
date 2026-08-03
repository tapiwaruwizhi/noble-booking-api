// src/app/api/auth/logout/route.js
// POST — clears the session cookie.

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function POST(req) {
  const r = NextResponse.json({ success: true });
  r.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}