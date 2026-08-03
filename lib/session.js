// src/lib/session.js
//
// Lightweight signed session tokens for the client portal.
// No external JWT library needed — HMAC-SHA256 over a base64url payload.
// Requires SESSION_SECRET env var (any long random string).

import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET;
const SESSION_DAYS = 7;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/**
 * Create a signed session token for a given contact.
 * @param {object} data - { contactId, contactUid, email, firstName }
 */
export function createSessionToken(data) {
  if (!SECRET) throw new Error("SESSION_SECRET env var is not set");
  const payload = {
    ...data,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a session token. Returns the payload if valid, or null if invalid/expired.
 */
export function verifySessionToken(token) {
  if (!SECRET || !token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSig = sign(encodedPayload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "nvc_session";
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60; // seconds, for cookie maxAge