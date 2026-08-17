// lib/email.js
//
// Sends transactional emails via Resend. Requires RESEND_API_KEY to be set
// (get one at https://resend.com after signing up).
//
// RESEND_FROM_EMAIL defaults to Resend's shared test sender, which only
// delivers to the email address you signed up to Resend with. Once you've
// verified a sending domain (e.g. noblevetclinic.com) in the Resend
// dashboard, set RESEND_FROM_EMAIL to an address on that domain
// (e.g. "Noble Vet Clinics <no-reply@noblevetclinic.com>") so it can send
// to any client.

import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL || "Noble Vet Clinics <onboarding@resend.dev>";

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function otpEmailHtml(code, firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `
    <div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; background: #F4F6F9; padding: 32px 16px;">
      <div style="max-width: 420px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px 28px;">
        <div style="font-family: Georgia, serif; font-size: 24px; color: #14171C; margin-bottom: 20px;">Noble</div>
        <p style="font-size: 15px; color: #14171C; margin: 0 0 8px;">${greeting}</p>
        <p style="font-size: 15px; color: #14171C; margin: 0 0 20px;">Your sign-in code for Noble Veterinary Clinics is:</p>
        <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #2465B4; text-align: center; background: #EAF1FA; border-radius: 12px; padding: 18px 0; margin-bottom: 20px;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #6B7280; margin: 0;">
          This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

/**
 * Sends the OTP login code by email. Returns true if the send succeeded
 * (or was skipped because no API key is configured, in which case the
 * caller should fall back to logging the code), false on a hard failure.
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
