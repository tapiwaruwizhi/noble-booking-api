// src/lib/cors.js
//
// CORS for an API serving two different kinds of caller:
//
//   * **Credentialed** (portal/auth) — the browser sends the session cookie with
//     `credentials: "include"`. The spec forbids `Access-Control-Allow-Origin: *`
//     on these; the exact Origin must be echoed back, plus
//     `Access-Control-Allow-Credentials: true`.
//   * **Public** (booking flow) — no cookie, callable from anywhere, `*` is fine.
//
// ⚠️ The wildcard used to ALSO be applied blanket-style to `/api/*` from BOTH
// `middleware.js` and `next.config.ts`. Those overrode the per-route
// credentialed headers and produced:
//
//   "The value of the 'Access-Control-Allow-Origin' header in the response must
//    not be the wildcard '*' when the request's credentials mode is 'include'."
//
// `next.config.ts` can only emit STATIC headers, so it can never get this right
// — its CORS block was removed. `middleware.js` now calls `getCorsHeaders()`
// below, so there is exactly one place that decides what CORS headers are sent.

// Exact origins, plus glob patterns where `*` matches a single DNS label
// (no dots, no slashes).
//
// The Framer entry is a pattern on purpose: Framer serves branch/preview builds
// from `easy-listening-989047--<branch-hash>.framer.app`, and that hash changes
// per deploy, so an exact list can never keep up. It is scoped to THIS site's
// slug rather than `*.framer.app` — the latter would let any Framer site in the
// world make credentialed requests to this API and read a client's records.
const DEFAULT_ALLOWED = [
  "https://noblevetclinic.com",
  "https://www.noblevetclinic.com",
  "https://easy-listening-989047*.framer.app",
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Allowlist = built-in defaults UNION anything in ALLOWED_ORIGINS.
 *
 * Deliberately a union, not a replacement. Previously the env var *replaced*
 * the defaults, so setting ALLOWED_ORIGINS in Vercel silently dropped the
 * Framer origins and broke the portal in a way that looked like a code bug.
 */
function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])];
}

/** True if `origin` matches an exact entry or a single-label glob pattern. */
export function isOriginAllowed(origin) {
  if (!origin) return false;
  return getAllowedOrigins().some((pattern) => {
    if (pattern === origin) return true;
    if (!pattern.includes("*")) return false;
    // `*` matches ONE DNS label — no "." and no "/" — so a pattern like
    // https://site*.framer.app cannot be satisfied by
    // https://evil.com/#.framer.app or https://a.b.framer.app
    const rx = new RegExp("^" + pattern.split("*").map(escapeRegex).join("[^./]*") + "$");
    return rx.test(origin);
  });
}

/**
 * Headers for a **credentialed** route (portal/auth — anything reading or
 * writing client data). Omits Access-Control-Allow-Origin entirely for an
 * unknown origin, so the browser blocks the response. That's intended: safer
 * than wildcarding, and the console warning names the offending origin.
 */
export function getCredentialedCorsHeaders(req) {
  const origin = req.headers.get("origin");

  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    // The response varies by Origin. Without this a CDN can cache the headers
    // for one origin and serve them to another — CORS failures that reproduce
    // only intermittently.
    Vary: "Origin",
  };

  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (origin) {
    console.warn("[cors] Origin not allowlisted, blocking:", origin);
  }

  return headers;
}

/**
 * Headers applied by middleware to every `/api/*` response.
 *
 * Allowlisted origin → echo it + allow credentials (the portal works).
 * Anything else      → `*` WITHOUT credentials, so the public booking
 *                      endpoints stay callable from anywhere (e.g. a brand-new
 *                      Framer preview hitting /api/startup before login).
 *
 * Never emits `*` together with `Allow-Credentials: true` — that exact
 * combination is what browsers reject.
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get("origin");

  if (isOriginAllowed(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}
