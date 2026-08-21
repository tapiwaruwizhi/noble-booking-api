// Applies CORS headers to every /api/* response.
//
// ⚠️ This used to hardcode `Access-Control-Allow-Origin: *` for all API routes.
// That silently overrode the per-route credentialed headers and broke the portal
// with "…must not be the wildcard '*' when the request's credentials mode is
// 'include'" — while leaving the React Native app unaffected, since native
// clients don't enforce CORS at all. Hence "works in the app, fails on web".
//
// It now delegates to lib/cors.js so the wildcard is only ever used for origins
// that aren't allowlisted (public booking endpoints), never alongside
// Allow-Credentials.

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";

export function middleware(request) {
  const headers = getCorsHeaders(request);

  // Answer preflight here so every route doesn't need its own OPTIONS handler
  // to be correct. Routes still export one; this just makes it moot.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
