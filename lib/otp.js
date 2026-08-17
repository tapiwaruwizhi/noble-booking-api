// src/lib/otp.js
//
// Stores one-time login codes using Vercel Blob as an ephemeral key-value
// store, keyed by normalized email/phone. Codes expire after 10 minutes.
//
// NOTE: this reuses Vercel Blob (already set up for images) purely as
// temporary storage. For higher volume, a real KV store (Vercel KV/Redis)
// would be more appropriate — but for this login volume, Blob is fine.

import { put, list, del } from "@vercel/blob";
import { sendOtpEmail } from "./email";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_PREFIX = "otp";

function otpKey(identifier) {
  const safe = identifier.toLowerCase().trim().replace(/[^a-z0-9@.+]/g, "_");
  return `${OTP_PREFIX}/${safe}.json`;
}

export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

export async function storeOtp(identifier, code, contactData) {
  const key = otpKey(identifier);
  const payload = JSON.stringify({
    code,
    contactData,
    expires: Date.now() + OTP_TTL_MS,
  });
  await put(key, payload, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  console.log("[otp] Stored OTP for:", identifier, "expires in 10 min");
}

export async function verifyOtp(identifier, code) {
  const key = otpKey(identifier);
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (blobs.length === 0) {
      console.log("[otp] No OTP found for:", identifier);
      return null;
    }
    const res = await fetch(blobs[0].url);
    const data = await res.json();

    if (Date.now() > data.expires) {
      console.log("[otp] OTP expired for:", identifier);
      await del(blobs[0].url).catch(() => {});
      return null;
    }
    if (data.code !== code) {
      console.log("[otp] OTP mismatch for:", identifier);
      return null;
    }

    // Valid — consume it (delete so it can't be reused)
    await del(blobs[0].url).catch(() => {});
    console.log("[otp] ✓ OTP verified for:", identifier);
    return data.contactData;
  } catch (err) {
    console.error("[otp] verifyOtp error:", err);
    return null;
  }
}

/**
 * Send the OTP code to the user. Emails are sent for real via Resend
 * (lib/email.js) when RESEND_API_KEY is configured. SMS delivery is still
 * a stub — phone-based OTP codes are only logged, not texted.
 */
export async function sendOtp(identifier, code, isEmail, firstName) {
  if (isEmail) {
    const sent = await sendOtpEmail(identifier, code, firstName);
    if (sent) return;
  }
  console.log("═══════════════════════════════════════");
  console.log(`[otp] ${isEmail ? "Email not sent (no RESEND_API_KEY?) — logging" : "SMS not wired up — logging"} code for ${identifier}:`);
  console.log(`[otp] CODE: ${code}`);
  console.log("═══════════════════════════════════════");
}