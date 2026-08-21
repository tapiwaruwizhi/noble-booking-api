// lib/signupToken.js
//
// Short-lived, single-use tokens that prove "whoever is holding this can read
// the mailbox we sent it to". Used for one thing only: the emailed
// /signup?token=… link we send when someone tries to sign in with an email
// address the clinic has no record of.
//
// ── Why not reuse lib/session.js ───────────────────────────────────────────
// Same HMAC-SHA256-over-base64url construction, deliberately DIFFERENT signing
// domain: everything here is signed over `signup:<payload>` rather than the
// bare payload. That domain separation is the whole point — without it, a
// signup token would verify as a *session* token, and an emailed link would be
// a login credential for an account that doesn't exist yet.
//
// ── Single use ─────────────────────────────────────────────────────────────
// The signature alone can't express "already used", so each token gets a `jti`
// and a matching marker object in Vercel Blob (the same store lib/otp.js uses).
// Consuming the token deletes the marker.
//
// If the Blob store is unreachable we treat the token as LIVE and log loudly,
// rather than locking a new client out of signing up over a storage hiccup.
// That is a deliberate fail-open, and it is safe because it is not the only
// guard: /api/auth/signup re-checks that no contact exists for the email
// before creating one, so a replayed token after a successful signup gets
// "you already have an account — sign in instead" regardless of the marker.

import crypto from "crypto";
import { put, list, del } from "@vercel/blob";

const SECRET = process.env.SESSION_SECRET;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PREFIX = "signup";

function sign(encodedPayload) {
  // NOTE the "signup:" domain separator — see the header comment.
  return crypto.createHmac("sha256", SECRET).update(`signup:${encodedPayload}`).digest("base64url");
}

function markerKey(jti) {
  return `${PREFIX}/${jti}.json`;
}

/**
 * Mint a signup token for an email address and record its marker.
 * @param {string} email - already normalised (trimmed + lowercased)
 * @returns {Promise<string>} the token
 */
export async function createSignupToken(email) {
  if (!SECRET) throw new Error("SESSION_SECRET env var is not set");
  const jti = crypto.randomBytes(16).toString("hex");
  const payload = { email, jti, exp: Date.now() + TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // The marker holds no secret — the token is the secret. It exists purely so
  // "has this been used?" has an answer.
  await put(markerKey(jti), JSON.stringify({ email, exp: payload.exp }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  console.log("[signupToken] issued for", email, "| jti:", jti, "| expires in 24h");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Check signature + expiry. Does NOT check single-use — call isSignupTokenLive
 * for that.
 * @returns {{email: string, jti: string, exp: number}|null}
 */
export function verifySignupToken(token) {
  if (!SECRET || !token || typeof token !== "string") return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload?.email || !payload?.jti) return null;
    if (!(payload.exp > Date.now())) return null; // expired (or exp missing/NaN)
    return payload;
  } catch {
    return null;
  }
}

async function findMarker(jti) {
  const { blobs } = await list({ prefix: markerKey(jti), limit: 1 });
  return blobs[0] ?? null;
}

/**
 * Has this token already been used?
 * @returns {Promise<{live: boolean, degraded: boolean}>}
 *   degraded === true means the Blob store couldn't be read and we fell open.
 */
export async function isSignupTokenLive(payload) {
  try {
    const marker = await findMarker(payload.jti);
    return { live: Boolean(marker), degraded: false };
  } catch (err) {
    console.error("[signupToken] marker lookup failed — failing OPEN:", err);
    return { live: true, degraded: true };
  }
}

/** Burn the token. Best-effort: a failure here is logged, not fatal. */
export async function consumeSignupToken(payload) {
  try {
    const marker = await findMarker(payload.jti);
    if (marker) await del(marker.url);
    console.log("[signupToken] consumed jti:", payload.jti);
  } catch (err) {
    console.error("[signupToken] consume failed (token left live until expiry):", err);
  }
}
