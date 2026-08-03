"use client";
// src/app/portal/page.jsx
// Client login portal — email/phone + OTP login, then tabbed dashboard:
// Profile, Bookings, Appointments, Pets.

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const T = {
  teal: "#00897B", tealDark: "#00695C", tealLight: "#E0F2F1", tealPale: "#F0FAF9",
  navy: "#0A1628", muted: "#6B7280", border: "#E2E8F0", bg: "#F8FAFB",
  error: "#E53E3E", white: "#FFFFFF",
};
const font = "'DM Sans', 'Helvetica Neue', sans-serif";
const isEmail = (v) => /\S+@\S+\.\S+/.test(v);

const EMOJI = { Dog: "🐕", Cat: "🐈", Rabbit: "🐇", Bird: "🦜", Other: "🐾" };

function fmtDate(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-AE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(unixSeconds) {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function PortalPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState(null);

  const [stage, setStage] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState("profile");
  const [pets, setPets] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setProfile(d.contact); setLoggedIn(true); })
      .catch(() => setLoggedIn(false))
      .finally(() => setCheckingSession(false));
  }, []);

  const handleRequestOtp = async () => {
    if (!identifier.trim()) { setError("Please enter your email or phone."); return; }
    setError(""); setLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      setStage("otp");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!code.trim()) { setError("Please enter the code."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      const meData = await meRes.json();
      setProfile(meData.contact);
      setLoggedIn(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setLoggedIn(false);
    setProfile(null);
    setStage("identifier");
    setIdentifier("");
    setCode("");
  };

  useEffect(() => {
    if (!loggedIn) return;
    if (tab === "pets" && !pets) {
      fetch(`${API_BASE}/api/portal/pets`, { credentials: "include" }).then(r => r.json()).then(d => setPets(d.pets || []));
    }
    if (tab === "appointments" && !appointments) {
      fetch(`${API_BASE}/api/portal/appointments`, { credentials: "include" }).then(r => r.json()).then(d => setAppointments(d.appointments || []));
    }
    if (tab === "bookings" && !bookings) {
      fetch(`${API_BASE}/api/portal/bookings`, { credentials: "include" }).then(r => r.json()).then(d => setBookings(d.bookings || []));
    }
  }, [tab, loggedIn]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .np-wrap { font-family: ${font}; background: ${T.bg}; min-height: 100vh; color: ${T.navy}; }
    .np-header { background: ${T.teal}; padding: 0 32px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
    .np-logo { color: #fff; font-size: 20px; font-weight: 700; }
    .np-logo span { color: ${T.tealLight}; }
    .np-logout { background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: ${font}; }
    .np-shell { max-width: 640px; margin: 0 auto; padding: 40px 20px; }
    .np-card { background: #fff; border: 1px solid ${T.border}; border-radius: 14px; padding: 28px; }
    .np-input { width: 100%; padding: 12px 14px; border: 1.5px solid ${T.border}; border-radius: 9px; font-family: ${font}; font-size: 14px; outline: none; margin-bottom: 6px; }
    .np-input:focus { border-color: ${T.teal}; }
    .np-btn { width: 100%; padding: 13px; background: ${T.teal}; color: #fff; border: none; border-radius: 9px; font-family: ${font}; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; }
    .np-btn:hover { background: ${T.tealDark}; }
    .np-btn:disabled { background: ${T.border}; cursor: not-allowed; }
    .np-error { color: ${T.error}; font-size: 13px; margin-top: 6px; }
    .np-tabs { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
    .np-tab { padding: 9px 16px; border-radius: 8px; border: 1.5px solid ${T.border}; background: #fff; font-size: 13px; font-weight: 500; cursor: pointer; font-family: ${font}; }
    .np-tab.active { background: ${T.teal}; border-color: ${T.teal}; color: #fff; }
    .np-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid ${T.border}; font-size: 13px; }
    .np-row:last-child { border-bottom: none; }
    .np-row-label { color: ${T.muted}; }
    .np-row-val { font-weight: 600; }
    .np-item-card { background: ${T.tealPale}; border: 1px solid ${T.border}; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
    .np-item-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .np-item-sub { font-size: 12px; color: ${T.muted}; }
    .np-loading { text-align: center; color: ${T.muted}; padding: 30px 0; font-size: 14px; }
  `;

  if (checkingSession) {
    return <><style>{css}</style><div className="np-wrap"><div className="np-loading" style={{ paddingTop: 100 }}>Loading…</div></div></>;
  }

  if (!loggedIn) {
    return (
      <>
        <style>{css}</style>
        <div className="np-wrap">
          <div className="np-header"><div className="np-logo">Noble<span>Vet</span> Portal</div></div>
          <div className="np-shell">
            <div className="np-card">
              {stage === "identifier" ? (
                <>
                  <h2 style={{ marginBottom: 6 }}>Sign in</h2>
                  <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Enter the email or phone number on your Noble Vet account.</p>
                  <input className="np-input" placeholder="you@example.com" value={identifier} onChange={e => setIdentifier(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRequestOtp()} autoFocus />
                  {error && <div className="np-error">{error}</div>}
                  <button className="np-btn" disabled={loading} onClick={handleRequestOtp}>{loading ? "Sending…" : "Send login code"}</button>
                </>
              ) : (
                <>
                  <h2 style={{ marginBottom: 6 }}>Enter your code</h2>
                  <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
                    We sent a 6-digit code to <strong>{identifier}</strong>. {isEmail(identifier) ? "Check your inbox." : "Check your messages."}
                  </p>
                  <input className="np-input" placeholder="123456" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleVerifyOtp()} autoFocus maxLength={6} />
                  {error && <div className="np-error">{error}</div>}
                  <button className="np-btn" disabled={loading} onClick={handleVerifyOtp}>{loading ? "Verifying…" : "Verify & sign in"}</button>
                  <button style={{ background: "none", border: "none", color: T.teal, fontSize: 12, marginTop: 12, cursor: "pointer" }} onClick={() => { setStage("identifier"); setCode(""); setError(""); }}>
                    ← Use a different email/phone
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="np-wrap">
        <div className="np-header">
          <div className="np-logo">Noble<span>Vet</span> Portal</div>
          <button className="np-logout" onClick={handleLogout}>Log out</button>
        </div>
        <div className="np-shell">
          <h2 style={{ marginBottom: 20 }}>Welcome, {profile?.first_name}</h2>

          <div className="np-tabs">
            {[
              ["profile", "Profile"], ["bookings", "Bookings"], ["appointments", "Appointments"], ["pets", "Pets"],
            ].map(([key, label]) => (
              <button key={key} className={`np-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          <div className="np-card">
            {tab === "profile" && profile && (
              <>
                <div className="np-row"><span className="np-row-label">Name</span><span className="np-row-val">{profile.first_name} {profile.last_name}</span></div>
                <div className="np-row"><span className="np-row-label">Email</span><span className="np-row-val">{profile.email || "—"}</span></div>
                <div className="np-row"><span className="np-row-label">Phone</span><span className="np-row-val">{profile.phone || "—"}</span></div>
              </>
            )}

            {tab === "bookings" && (
              !bookings ? <div className="np-loading">Loading your bookings…</div> :
              bookings.length === 0 ? <div className="np-loading">No bookings made through our website yet.</div> :
              bookings.map(b => (
                <div key={b.id} className="np-item-card">
                  <div className="np-item-title">{fmtDate(b.start_time)} at {fmtTime(b.start_time)}</div>
                  <div className="np-item-sub">Ref: {b.reference} · {b.description?.split("|")[0]?.trim()}</div>
                </div>
              ))
            )}

            {tab === "appointments" && (
              !appointments ? <div className="np-loading">Loading your appointments…</div> :
              appointments.length === 0 ? <div className="np-loading">No appointments found.</div> :
              appointments.map(a => (
                <div key={a.id} className="np-item-card">
                  <div className="np-item-title">{fmtDate(a.start_time)} at {fmtTime(a.start_time)}</div>
                  <div className="np-item-sub">{a.description?.split("|")[0]?.trim() || "Appointment"}</div>
                </div>
              ))
            )}

            {tab === "pets" && (
              !pets ? <div className="np-loading">Loading your pets…</div> :
              pets.length === 0 ? <div className="np-loading">No pets on file yet.</div> :
              pets.map(p => (
                <div key={p.id} className="np-item-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{EMOJI[p.species] || "🐾"}</span>
                  <div>
                    <div className="np-item-title">{p.name}</div>
                    <div className="np-item-sub">{p.breed} · {p.sex} · {p.age}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}