"use client";

// app/signup/page.jsx
//
// The landing page for the emailed "create your account" link.
//
// ── Why it lives on the API domain and not in Framer ────────────────────────
// The session cookie is httpOnly + Secure + SameSite=None and is set on THIS
// origin. Signing up here means the cookie is already in place by the time the
// person clicks "Continue to your account" — no token in a URL, nothing to
// hand over, nothing for Framer to implement.
//
// ── The email field is display-only ─────────────────────────────────────────
// The address comes back from GET /api/auth/signup and is rendered read-only.
// It is NOT posted back; the server takes it from the signed token. Making it
// editable would turn this into an open account-creation form (see the route).
//
// ── ⚠️ Every class is namespaced `nvc-su-` ─────────────────────────────────
// The root layout imports globals.css, which pulls in Tailwind. A plain class
// name like `.fixed` is a TAILWIND UTILITY (`position: fixed`) and wins — the
// first version of this page used `.fixed` for the email row and Tailwind
// ripped it out of the document flow, which the screenshot caught. Don't use
// bare names here; prefix everything.

import { useEffect, useState } from "react";

const PORTAL_FALLBACK = "https://noblevetclinic.com";

export default function SignupPage() {
  const [phase, setPhase]   = useState("checking"); // checking | form | done | dead
  const [token, setToken]   = useState("");
  const [email, setEmail]   = useState("");
  const [first, setFirst]   = useState("");
  const [last, setLast]     = useState("");
  const [phone, setPhone]   = useState("");
  const [error, setError]   = useState("");
  const [deadMsg, setDead]  = useState("");
  const [busy, setBusy]     = useState(false);
  const [name, setName]     = useState("");
  const [portal, setPortal] = useState(PORTAL_FALLBACK);

  // Read the token from the URL directly rather than via useSearchParams, which
  // would drag a Suspense boundary in for no benefit on a page this small.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) {
      setDead("That link is missing its code. Open the link from your email again, or enter your email address in the app to get a new one.");
      setPhase("dead");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res  = await fetch(`/api/auth/signup?token=${encodeURIComponent(t)}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (data?.valid) {
          setEmail(data.email || "");
          if (data.portal_url) setPortal(data.portal_url);
          setPhase("form");
        } else {
          setDead(data?.message || "This link is no longer valid.");
          setPhase("dead");
        }
      } catch {
        if (!alive) return;
        // A network failure is not a dead link — say so, and let them retry.
        setDead("We couldn't check this link just now. Check your connection and reload the page.");
        setPhase("dead");
      }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!first.trim()) { setError("Please enter your first name."); return; }
    if (!phone.trim()) { setError("Please enter a phone number."); return; }
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          first_name: first.trim(),
          last_name:  last.trim(),
          phone:      phone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 = the account already exists. That's not a form error to correct,
        // it's a different next step, so it gets the dead-end screen with the
        // "go and sign in" wording rather than a red line under a field.
        if (res.status === 409) { setDead(data?.error || "You already have an account."); setPhase("dead"); return; }
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setName(data?.firstName || first.trim());
      if (data?.portal_url) setPortal(data.portal_url);
      setPhase("done");
    } catch {
      setError("We couldn't reach the clinic just now. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="nvc-su-wrap">
      <style>{CSS}</style>

      <div className="nvc-su-card">
        <div className="nvc-su-brand">
          <div className="nvc-su-mark">Noble</div>
          <div className="nvc-su-sub">Veterinary Clinics</div>
        </div>

        {phase === "checking" && (
          <p className="nvc-su-muted nvc-su-center">Checking your link…</p>
        )}

        {phase === "dead" && (
          <>
            <h1 className="nvc-su-h1">We can't use that link</h1>
            <p className="nvc-su-muted">{deadMsg}</p>
            <a className="nvc-su-btn nvc-su-ghost" href={portal}>Back to Noble Vet Clinics</a>
          </>
        )}

        {phase === "form" && (
          <form onSubmit={submit} noValidate>
            <h1 className="nvc-su-h1">Create your account</h1>
            <p className="nvc-su-muted">
              We don't have a record for this email address yet. Tell us who you
              are and we'll set you up.
            </p>

            <label className="nvc-su-lbl">Email address</label>
            <div className="nvc-su-emailbox" title="This is the address we emailed your link to">
              <span className="nvc-su-emailval">{email}</span>
              <span className="nvc-su-lock" aria-hidden="true">🔒</span>
            </div>
            <p className="nvc-su-hint">
              This is the address your link was sent to, so it can't be changed here.
            </p>

            <div className="nvc-su-row">
              <div>
                <label className="nvc-su-lbl" htmlFor="first">First name</label>
                <input id="first" className="nvc-su-in" value={first} autoComplete="given-name"
                       onChange={(e) => { setFirst(e.target.value); setError(""); }} />
              </div>
              <div>
                <label className="nvc-su-lbl" htmlFor="last">Last name</label>
                <input id="last" className="nvc-su-in" value={last} autoComplete="family-name"
                       onChange={(e) => { setLast(e.target.value); setError(""); }} />
              </div>
            </div>

            <label className="nvc-su-lbl" htmlFor="phone">Mobile number</label>
            <input id="phone" className="nvc-su-in" value={phone} inputMode="tel" autoComplete="tel"
                   placeholder="+971 50 123 4567"
                   onChange={(e) => { setPhone(e.target.value); setError(""); }} />
            <p className="nvc-su-hint">So the clinic can reach you about appointments.</p>

            {error && <p className="nvc-su-err" role="alert">{error}</p>}

            <button className="nvc-su-btn" type="submit" disabled={busy}>
              {busy ? "Creating your account…" : "Create account"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <>
            <div className="nvc-su-tick" aria-hidden="true">✓</div>
            <h1 className="nvc-su-h1">You're all set{name ? `, ${name}` : ""}</h1>
            <p className="nvc-su-muted">
              Your account is ready and you're signed in. You can book
              appointments, add your pets and see your visit history.
            </p>
            <a className="nvc-su-btn" href={portal}>Continue to your account</a>
            <p className="nvc-su-hint nvc-su-center" style={{ marginTop: 16 }}>
              Using the Noble Vet app? Open it and sign in with{" "}
              <strong>{email}</strong> — we'll send you a code.
            </p>
          </>
        )}
      </div>

      <p className="nvc-su-foot">Noble Veterinary Clinics · Dubai</p>
    </main>
  );
}

const CSS = `
  .nvc-su-wrap {
    min-height: 100vh; background: #F4F6F9;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 32px 16px;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #14171C;
  }
  .nvc-su-card {
    width: 100%; max-width: 440px; background: #fff; border: 1px solid #E6E9EF;
    border-radius: 18px; padding: 32px 28px;
  }
  .nvc-su-brand { text-align: center; margin-bottom: 26px; }
  .nvc-su-mark  { font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 1; }
  .nvc-su-sub   { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6B7280; margin-top: 6px; }
  .nvc-su-h1    { font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 400; margin: 0 0 8px; }
  .nvc-su-muted { font-size: 14.5px; line-height: 1.55; color: #4B5563; margin: 0 0 22px; }
  .nvc-su-center { text-align: center; }
  .nvc-su-lbl   { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin: 0 0 6px; }
  .nvc-su-in {
    display: block; width: 100%; box-sizing: border-box; font: inherit; font-size: 15px;
    padding: 12px 14px; border: 1px solid #D8DDE6; border-radius: 12px; background: #fff; color: #14171C;
  }
  .nvc-su-in:focus { outline: none; border-color: #2465B4; box-shadow: 0 0 0 3px rgba(36,101,180,.14); }
  .nvc-su-emailbox {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    width: 100%; box-sizing: border-box;
    font-size: 15px; padding: 12px 14px; border: 1px solid #E6E9EF; border-radius: 12px;
    background: #F4F6F9; color: #4B5563;
  }
  .nvc-su-emailval { min-width: 0; overflow-wrap: anywhere; }
  .nvc-su-lock  { opacity: .5; font-size: 13px; flex: none; }
  .nvc-su-hint  { font-size: 12.5px; color: #6B7280; margin: 6px 0 18px; line-height: 1.5; }
  .nvc-su-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .nvc-su-err   { font-size: 13.5px; color: #B42318; background: #FEF3F2; border: 1px solid #FDA29B;
                  border-radius: 10px; padding: 10px 12px; margin: 0 0 16px; }
  .nvc-su-btn {
    display: block; width: 100%; box-sizing: border-box; text-align: center; text-decoration: none;
    font: inherit; font-size: 15px; font-weight: 600; color: #fff; background: #2465B4;
    border: 1px solid #2465B4; border-radius: 999px; padding: 14px 20px; cursor: pointer; margin-top: 4px;
  }
  .nvc-su-btn:hover:not(:disabled) { background: #1D5397; }
  .nvc-su-btn:disabled { opacity: .6; cursor: default; }
  .nvc-su-btn.nvc-su-ghost { background: #fff; color: #2465B4; }
  .nvc-su-btn.nvc-su-ghost:hover { background: #EAF1FA; }
  .nvc-su-tick {
    width: 52px; height: 52px; border-radius: 50%; background: #EAF1FA; color: #2465B4;
    display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 0 18px;
  }
  .nvc-su-foot { font-size: 12px; color: #9AA1AC; margin-top: 22px; }
  @media (max-width: 420px) {
    .nvc-su-card { padding: 26px 20px; }
    .nvc-su-row  { grid-template-columns: 1fr; }
  }
`;
