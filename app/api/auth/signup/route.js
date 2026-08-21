// app/api/auth/signup/route.js
//
// The other half of the emailed sign-up link.
//
//   GET  /api/auth/signup?token=…   → is this link still good, and for whom?
//   POST /api/auth/signup           → { token, first_name, last_name, phone }
//                                     creates the ezyVet contact and signs them in.
//
// ── The email address is NOT user input here ────────────────────────────────
// It comes out of the signed token, never out of the request body. That's what
// makes this safe: the only person who can create an account for
// ali@example.com is someone who received our email at ali@example.com. If you
// ever "helpfully" accept an `email` field from the form, you have built an
// open account-creation endpoint. Don't.
//
// This route is called from our own /signup page (same origin), and never from
// Framer or the app, but it still carries the credentialed CORS headers so a
// future same-flow call from the portal doesn't need a second implementation.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";
import { verifySignupToken, isSignupTokenLive, consumeSignupToken } from "@/lib/signupToken";
import { getPortalUrl } from "@/lib/appUrl";

const EMAIL_TYPE = 1;
const PHONE_TYPE = 3;

const cors = (req, r) => {
  Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
  return r;
};

/** Resolve a token to a payload, or to the reason it's no good. */
async function resolveToken(raw) {
  const payload = verifySignupToken(raw);
  if (!payload) {
    // Deliberately one bucket: a tampered token and an expired one get the
    // same message, because "expired" tells an attacker their forgery parsed.
    return { payload: null, reason: "invalid" };
  }
  const { live, degraded } = await isSignupTokenLive(payload);
  if (!live) return { payload: null, reason: "used" };
  return { payload, reason: null, degraded };
}

const REASON_TEXT = {
  invalid: "This link has expired or is no longer valid. Enter your email address again to get a new one.",
  used:    "This link has already been used. If you've finished signing up, just sign in with your email address.",
};

// ── GET: validate before rendering the form ────────────────────────────────
export async function GET(req) {
  try {
    const raw = new URL(req.url).searchParams.get("token");
    if (!raw) return cors(req, NextResponse.json({ valid: false, reason: "invalid", message: REASON_TEXT.invalid }, { status: 400 }));

    const { payload, reason } = await resolveToken(raw);
    if (!payload) {
      return cors(req, NextResponse.json({ valid: false, reason, message: REASON_TEXT[reason] }, { status: 400 }));
    }
    // portal_url comes from the server so the "Continue to your account"
    // button can move (Framer → custom domain) without a redeploy of the page.
    return cors(req, NextResponse.json({ valid: true, email: payload.email, portal_url: getPortalUrl() }));
  } catch (err) {
    console.error("[/api/auth/signup] GET error:", err);
    return cors(req, NextResponse.json({ valid: false, reason: "error", message: "Something went wrong. Please try again." }, { status: 500 }));
  }
}

// ── POST: create the contact and sign them in ──────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const raw       = body?.token;
    const firstName = String(body?.first_name ?? "").trim();
    const lastName  = String(body?.last_name  ?? "").trim();
    const phone     = String(body?.phone      ?? "").trim();

    const { payload, reason } = await resolveToken(raw);
    if (!payload) {
      console.warn("[/api/auth/signup] rejected token —", reason);
      return cors(req, NextResponse.json({ error: REASON_TEXT[reason] }, { status: 400 }));
    }
    const email = payload.email;

    if (!firstName) return cors(req, NextResponse.json({ error: "Please enter your first name." }, { status: 400 }));
    // ezyVet rejects an empty last_name, and "-" is what /api/book already
    // sends for single-word names — keep the two consistent so the clinic
    // doesn't end up with two conventions in the contact list.
    const last = lastName || "-";
    if (!phone)     return cors(req, NextResponse.json({ error: "Please enter a phone number so the clinic can reach you." }, { status: 400 }));
    // Loose on purpose: UAE numbers arrive as +971…, 05…, with and without
    // spaces. Rejecting formats here helps nobody — the clinic dials it, not us.
    if (phone.replace(/[^\d]/g, "").length < 7) {
      return cors(req, NextResponse.json({ error: "That phone number looks too short." }, { status: 400 }));
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };
    const authJson = { ...headers, "Content-Type": "application/json" };

    console.log("═══════════════════════════════════════");
    console.log("[/api/auth/signup] creating contact for:", email);

    // ── Guard: did a contact appear since the link was emailed? ─────────────
    // Two reasons this matters. (1) Replay: if the token's single-use marker
    // was lost (see lib/signupToken.js's fail-open), this is the backstop that
    // stops a second contact being created. (2) Race: the clinic may have
    // added them manually in the meantime, and a duplicate contact record is a
    // genuinely painful thing to clean up in a practice-management system.
    const cdRes = await fetch(`${base}/v1/contactdetail?active=1&value=${encodeURIComponent(email)}&limit=10`, { headers });
    if (cdRes.ok) {
      const cdData = await cdRes.json().catch(() => ({}));
      const dup = (cdData.items ?? []).find((i) => {
        const d = i.contactdetail ?? i;
        return String(d.contact_detail_type_id ?? d.type_id ?? "") === String(EMAIL_TYPE)
          && d.value?.trim().toLowerCase() === email;
      });
      if (dup) {
        console.log("[/api/auth/signup] contact already exists — refusing to duplicate");
        await consumeSignupToken(payload);
        return cors(req, NextResponse.json({
          error: "You already have an account with us. Go back and sign in with your email address and we'll send you a code.",
          already_exists: true,
        }, { status: 409 }));
      }
    } else {
      // Can't confirm either way. Creating a duplicate is worse than asking
      // them to try again in a minute, so stop here.
      console.error("[/api/auth/signup] contactdetail lookup failed:", cdRes.status);
      return cors(req, NextResponse.json({ error: "We couldn't reach the clinic's records just now. Please try again in a moment." }, { status: 503 }));
    }

    // ── Create the contact (v2 — v1 doesn't return uid, and the session
    //    needs one for the v2 reads the portal does) ─────────────────────────
    //
    // ⚠️ Only send fields you want SET. ezyVet throws InvalidParameterException
    // on boolean `false` (e.g. is_business: false) — omit instead of negating.
    const contactPayload = {
      first_name:  firstName,
      last_name:   last,
      is_customer: 1,
      contact_detail_list: [
        { name: "Email",  value: email, type_id: EMAIL_TYPE, preferred: 1 },
        { name: "Mobile", value: phone, type_id: PHONE_TYPE, preferred: 0 },
      ],
    };

    const cRes  = await fetch(`${base}/v2/contact`, {
      method: "POST", headers: authJson, body: JSON.stringify(contactPayload),
    });
    const cText = await cRes.text();
    console.log("[/api/auth/signup] contact create status:", cRes.status);

    if (!cRes.ok) {
      console.error("[/api/auth/signup] contact create failed:", cText.slice(0, 500));
      return cors(req, NextResponse.json({ error: "We couldn't create your account. Please call the clinic and we'll set it up for you." }, { status: 502 }));
    }

    let contact = null;
    try {
      const cData = JSON.parse(cText);
      contact = cData.items?.[0]?.contact ?? cData.contact ?? null;
    } catch {
      console.error("[/api/auth/signup] contact create returned unparseable body:", cText.slice(0, 300));
    }

    if (!contact?.id) {
      // The contact may well have been created — we just can't see its id, so
      // we can't mint a session. Sending them to sign in is correct: the OTP
      // lookup will find whatever was created.
      console.error("[/api/auth/signup] contact created but no id returned");
      await consumeSignupToken(payload);
      return cors(req, NextResponse.json({ error: "Your account was created, but we couldn't sign you in automatically. Please go back and sign in with your email address." }, { status: 502 }));
    }

    console.log("[/api/auth/signup] ✓ contact created — id:", contact.id, "uid:", contact.uid);

    // Burn the link now that it has done its job.
    await consumeSignupToken(payload);

    const sessionToken = createSessionToken({
      contactId:  contact.id,
      contactUid: contact.uid,
      email,
      firstName:  contact.first_name ?? firstName,
    });

    console.log("═══════════════════════════════════════");

    // Same dual delivery as verify-otp: cookie for the web portal, `token` in
    // the body for anything without a cookie jar. Setting the cookie here is
    // the whole reason this page lives on the API domain — by the time the
    // browser follows "Continue to your account", it is already signed in.
    const r = NextResponse.json({
      success:    true,
      firstName:  contact.first_name ?? firstName,
      token:      sessionToken,
      expires_in: SESSION_MAX_AGE,
      portal_url: getPortalUrl(),
    });
    r.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return cors(req, r);

  } catch (err) {
    console.error("[/api/auth/signup] error:", err);
    return cors(req, NextResponse.json({ error: "Internal server error" }, { status: 500 }));
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}
