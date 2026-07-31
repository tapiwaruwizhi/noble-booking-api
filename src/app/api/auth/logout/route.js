// src/app/api/auth/logout/route.js
// POST — clears the session cookie.

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

export async function POST() {
  const r = NextResponse.json({ success: true });
  r.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  r.headers.set("Access-Control-Allow-Origin", CORS);
  return r;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}