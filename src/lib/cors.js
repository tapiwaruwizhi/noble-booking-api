// src/lib/cors.js
//
// CORS helper for routes that need cookies (credentials: "include").
// Browsers reject "Access-Control-Allow-Origin: *" whenever a request
// carries credentials — the origin must be echoed back exactly, plus
// "Access-Control-Allow-Credentials: true" must be set.
//
// Set ALLOWED_ORIGINS in Vercel to a comma-separated list of exact origins,
// e.g. "https://noblevetclinic.com,https://easy-listening-989047.framer.app"
// Falls back to a small built-in allowlist if the env var isn't set.

const DEFAULT_ALLOWED = [
  "https://noblevetclinic.com",
  "https://www.noblevetclinic.com",
  "https://easy-listening-989047.framer.app",
];

function getAllowedOrigins() {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (fromEnv) return fromEnv.split(",").map(o => o.trim());
  return DEFAULT_ALLOWED;
}

/**
 * Returns the CORS headers to attach for a credentialed (cookie-based) request.
 * Echoes the request's Origin header back ONLY if it's on the allowlist —
 * otherwise omits Access-Control-Allow-Origin entirely, which makes the
 * browser block the response (safer than wildcarding).
 */
export function getCredentialedCorsHeaders(req) {
  const origin = req.headers.get("origin");
  const allowed = getAllowedOrigins();

  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (origin) {
    console.warn("[cors] Origin not in allowlist, blocking:", origin, "| allowed:", allowed);
  }

  return headers;
}