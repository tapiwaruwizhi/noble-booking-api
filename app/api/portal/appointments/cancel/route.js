// src/app/api/portal/appointments/cancel/route.js
// POST { appointment_id } — cancels an appointment belonging to the logged-in contact.
//
// ezyVet doesn't expose a dedicated "cancel" action — cancelling is done by
// setting the appointment's status_id to whatever status is labelled
// "Cancelled" on this ezyVet instance. Status IDs vary per instance, so the
// label is resolved live via /v2/appointmentstatus rather than hardcoded
// (same pattern as lib/appointmentStatus.js elsewhere in this project).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getAppointmentStatusMap, findStatusIdByKeyword } from "@/lib/appointmentStatus";

export async function POST(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { appointment_id } = await req.json();
    if (!appointment_id) {
      const r = NextResponse.json({ error: "appointment_id is required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers      = { Authorization: `Bearer ${token}` };
    const jsonHeaders  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const patchHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/merge-patch+json" };

    // ── Ownership check — never let a client cancel another client's appointment ──
    const checkRes  = await fetch(`${base}/v2/appointment?id=${appointment_id}&limit=1`, { headers });
    const checkData = await checkRes.json();
    const existing  = checkData.items?.[0]?.appointment ?? checkData.appointment;

    if (!existing || String(existing.contact_id) !== String(session.contactId)) {
      console.warn("[/api/portal/appointments/cancel] Ownership check failed — appointment_id:", appointment_id, "session contact:", session.contactId, "appt contact:", existing?.contact_id);
      const r = NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const statusMap    = await getAppointmentStatusMap(base, headers);
    const cancelledId  = findStatusIdByKeyword(statusMap, "cancel");

    if (!cancelledId) {
      console.error("[/api/portal/appointments/cancel] No 'Cancelled' status found in:", statusMap);
      const r = NextResponse.json({ error: "Could not resolve a 'Cancelled' status on this ezyVet instance" }, { status: 502 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const payload = { status_id: Number(cancelledId) };
    console.log("[/api/portal/appointments/cancel] Cancelling appointment_id:", appointment_id, "→ status_id:", cancelledId);

    let updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload) });
    let updText = await updRes.text();
    console.log("[/api/portal/appointments/cancel] v1 PATCH status:", updRes.status, updText);

    if (!updRes.ok && updText.includes("unknown or unsupported")) {
      console.log("[/api/portal/appointments/cancel] PATCH unsupported — trying PUT");
      updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) });
      updText = await updRes.text();
      console.log("[/api/portal/appointments/cancel] v1 PUT status:", updRes.status, updText);
    }

    if (!updRes.ok) {
      const r = NextResponse.json({ error: "Failed to cancel appointment", detail: updText }, { status: 502 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const r = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/appointments/cancel] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}
