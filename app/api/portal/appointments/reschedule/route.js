// src/app/api/portal/appointments/reschedule/route.js
// POST { appointment_id, start_iso, duration_minutes? } — moves an appointment
// belonging to the logged-in contact to a new start time.
//
// This directly updates the ezyVet appointment's start_at/duration rather than
// cancelling + rebooking through ezyCAB — simpler and preserves the same
// appointment record (reference, history, etc). It does not (yet) run a live
// availability check against the vet's calendar before saving — the frontend
// uses /api/slots to check availability when it can resolve the appointment's
// resource + type UIDs (see `slot_check_available` on /api/portal/appointments),
// and otherwise submits the requested time directly.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function POST(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { appointment_id, start_iso, duration_minutes } = await req.json();
    if (!appointment_id || !start_iso) {
      const r = NextResponse.json({ error: "appointment_id and start_iso are required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const newStart = new Date(start_iso);
    if (Number.isNaN(newStart.getTime())) {
      const r = NextResponse.json({ error: "start_iso is not a valid date" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers      = { Authorization: `Bearer ${token}` };
    const jsonHeaders  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const patchHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/merge-patch+json" };

    // ── Ownership check — never let a client reschedule another client's appointment ──
    const checkRes  = await fetch(`${base}/v2/appointment?id=${appointment_id}&limit=1`, { headers });
    const checkData = await checkRes.json();
    const existing  = checkData.items?.[0]?.appointment ?? checkData.appointment;

    if (!existing || String(existing.contact_id) !== String(session.contactId)) {
      console.warn("[/api/portal/appointments/reschedule] Ownership check failed — appointment_id:", appointment_id, "session contact:", session.contactId, "appt contact:", existing?.contact_id);
      const r = NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const durationSeconds = duration_minutes
      ? Math.round(duration_minutes * 60)
      : (existing.duration ?? 900); // fall back to the existing duration (seconds)

    const payload = {
      start_at: Math.floor(newStart.getTime() / 1000),
      duration: durationSeconds,
    };

    console.log("[/api/portal/appointments/reschedule] Rescheduling appointment_id:", appointment_id, "→", JSON.stringify(payload));

    let updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload) });
    let updText = await updRes.text();
    console.log("[/api/portal/appointments/reschedule] v1 PATCH status:", updRes.status, updText);

    if (!updRes.ok && updText.includes("unknown or unsupported")) {
      console.log("[/api/portal/appointments/reschedule] PATCH unsupported — trying PUT");
      updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) });
      updText = await updRes.text();
      console.log("[/api/portal/appointments/reschedule] v1 PUT status:", updRes.status, updText);
    }

    if (!updRes.ok) {
      const r = NextResponse.json({ error: "Failed to reschedule appointment", detail: updText }, { status: 502 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const r = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/appointments/reschedule] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}
