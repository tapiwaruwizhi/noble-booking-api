// lib/email.js
//
// Two unrelated-but-adjacent jobs live here, and they are kept in ONE file on
// purpose: everything that has to do with an email address.
//
//   1. VALIDATION — `isEmail` / `normalizeEmail`, shared with the web portal
//      (frontend/BookingFlow.jsx) and the React Native app (src/lib/validate.js).
//   2. SENDING — transactional email via Resend: the sign-in code, and the
//      sign-up link for people the clinic has no record of.
//
// ⚠️ HISTORY: an earlier edit replaced this file with the validator alone,
// which silently deleted `sendOtpEmail` while `lib/otp.js` still imported it —
// meaning every login attempt would have thrown at send time. If you split this
// file, grep for BOTH sets of exports first.
//
// ── Sending config ──────────────────────────────────────────────────────────
// Requires RESEND_API_KEY. RESEND_FROM_EMAIL defaults to Resend's shared test
// sender, which only delivers to the address the Resend account signed up with.
// Once a sending domain is verified (e.g. noblevetclinic.com), set
// RESEND_FROM_EMAIL to an address on it, e.g.
// "Noble Vet Clinics <no-reply@noblevetclinic.com>".

import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL || "Noble Vet Clinics <onboarding@resend.dev>";

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════════════
//
// The pattern is the WHATWG/HTML5 `<input type="email">` production plus two
// deliberate additions:
//
//   1. **A dot is required in the domain.** The spec accepts `ali@dip` because
//      intranet hosts are legal. For a public clinic portal that's always a
//      typo — and it means the OTP silently never arrives.
//   2. **RFC 5321 length limits** — 64 chars local part, 254 total. Longer
//      addresses are refused by real mail servers.
//
// Deliberately no stricter. Over-clever email regexes reject perfectly valid
// addresses (plus-tags, apostrophes, long TLDs, single-letter domains), and the
// only real proof an address works is that the code arrives.

const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmail(value) {
  const s = String(value ?? "").trim();
  if (s.length === 0 || s.length > 254) return false;
  const at = s.lastIndexOf("@");
  if (at < 1 || at > 64) return false;
  if (s.includes("..")) return false;
  return EMAIL_RE.test(s);
}

/** Trim + lowercase, so casing/whitespace can't split one client into two. */
export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

// ════════════════════════════════════════════════════════════════════════════
// SENDING
// ════════════════════════════════════════════════════════════════════════════

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Shared shell so the two emails look like the same clinic sent them. */
function shell(inner) {
  return `
    <div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; background: #F4F6F9; padding: 32px 16px;">
      <div style="max-width: 460px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px 28px;">
        <div style="font-family: Georgia, serif; font-size: 24px; color: #14171C; margin-bottom: 20px;">Noble</div>
        ${inner}
      </div>
    </div>
  `;
}

function otpEmailHtml(code, firstName) {
  const greeting = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  return shell(`
    <p style="font-size: 15px; color: #14171C; margin: 0 0 8px;">${greeting}</p>
    <p style="font-size: 15px; color: #14171C; margin: 0 0 20px;">Your sign-in code for Noble Veterinary Clinics is:</p>
    <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #2465B4; text-align: center; background: #EAF1FA; border-radius: 12px; padding: 18px 0; margin-bottom: 20px;">
      ${esc(code)}
    </div>
    <p style="font-size: 13px; color: #6B7280; margin: 0;">
      This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
    </p>
  `);
}

function signupEmailHtml(link) {
  return shell(`
    <p style="font-size: 15px; color: #14171C; margin: 0 0 8px;">Hi,</p>
    <p style="font-size: 15px; color: #14171C; margin: 0 0 20px;">
      You asked to sign in to Noble Veterinary Clinics, but we don't have an
      account for this email address yet. Create one here — it takes a minute:
    </p>
    <div style="text-align: center; margin: 0 0 22px;">
      <a href="${esc(link)}"
         style="display: inline-block; background: #2465B4; color: #ffffff; text-decoration: none;
                font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 999px;">
        Create your account
      </a>
    </div>
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 12px;">
      Or paste this link into your browser:<br>
      <span style="word-break: break-all; color: #2465B4;">${esc(link)}</span>
    </p>
    <p style="font-size: 13px; color: #6B7280; margin: 0;">
      This link expires in 24 hours and can only be used once. If you didn't
      request it, you can safely ignore this email — nothing has been created.
    </p>
  `);
}

/**
 * Sends the OTP login code by email. Returns true if the send succeeded,
 * false if it failed OR if no API key is configured — in which case the
 * caller falls back to logging the code (see lib/otp.js).
 */
export async function sendOtpEmail(to, code, firstName) {
  const client = getClient();
  if (!client) {
    console.log("[email] RESEND_API_KEY not set — skipping real send, code will be logged instead");
    return false;
  }
  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      subject: "Your Noble Vet login code",
      html: otpEmailHtml(code, firstName),
    });
    if (error) {
      console.error("[email] Resend send failed:", error);
      return false;
    }
    console.log("[email] OTP email sent to:", to);
    return true;
  } catch (err) {
    console.error("[email] sendOtpEmail error:", err);
    return false;
  }
}

/**
 * Sends the "we don't know you yet — create an account" link. Same
 * true/false contract as sendOtpEmail.
 *
 * NOTE: the link is the ONLY thing proving the recipient controls this
 * mailbox, so it must never be logged in full anywhere but here.
 */
export async function sendSignupLinkEmail(to, link) {
  const client = getClient();
  if (!client) {
    console.log("═══════════════════════════════════════");
    console.log("[email] RESEND_API_KEY not set — signup link NOT emailed. Link for", to, "is:");
    console.log("[email]", link);
    console.log("═══════════════════════════════════════");
    return false;
  }
  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      subject: "Create your Noble Vet account",
      html: signupEmailHtml(link),
    });
    if (error) {
      console.error("[email] Resend signup-link send failed:", error);
      return false;
    }
    console.log("[email] Signup link emailed to:", to);
    return true;
  } catch (err) {
    console.error("[email] sendSignupLinkEmail error:", err);
    return false;
  }
}
