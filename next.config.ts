import type { NextConfig } from "next";

// NOTE: CORS headers are deliberately NOT configured here.
//
// `headers()` can only emit STATIC values, so the only thing it could say is
// `Access-Control-Allow-Origin: *` — which is invalid for credentialed
// (cookie-bearing) requests and silently overrode the correct per-origin
// headers set by middleware.js and the portal routes. CORS now lives in exactly
// one place: lib/cors.js, applied via middleware.js.
const nextConfig: NextConfig = {};

export default nextConfig;
