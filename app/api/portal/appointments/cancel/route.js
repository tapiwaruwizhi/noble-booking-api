// src/app/api/portal/appointments/cancel/route.js
// POST { appointment_id } — cancels an appointment belonging to the logged-in contact.
//
// Uses ezyVet's dedicated cancel payload shape on PATCH/PUT /v1/appointment/{id}:
//   { cancel, cancellation_reason, cancellation_reason_text, status_id,
//     description, animal_id, consult_id }
// `status_id` still needs to be the "Cancelled" status for this ezyVet
// instance — IDs vary per instance, so it's resolved live via
// /v2/appointmentstatus rather than hardcoded (same pattern as
// lib/appointmentStatus.js elsewhere in this project).

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

    const payload = {
      cancel:                    true,
      cancellation_reason:       0,
      cancellation_reason_text:  "Cancelled via client portal",
      status_id:                 String(cancelledId),
      description:               existing.description ?? "",
      animal_id:                 existing.animal_id != null ? String(existing.animal_id) : "",
      consult_id:                existing.consult_id != null ? String(existing.consult_id) : "",
    };
    console.log("[/api/portal/appointments/cancel] Cancelling appointment_id:", appointment_id, "→", JSON.stringify(payload));

    // Parses + logs ezyVet's error shape defensively and always prints the raw
    // response text too, so nothing gets lost if the envelope shape is wrong
    // (same pattern used in the reschedule route).
    const logEzyvetError = (label, status, text) => {
      console.error(`[/api/portal/appointments/cancel] ${label} — status:`, status, "| raw:", text);
      let err = null;
      try {
        const parsed = JSON.parse(text);
        err = Array.isArray(parsed) ? parsed[0]
            : parsed?.errors?.[0] ?? parsed?.error?.[0] ?? parsed?.error ?? parsed;
      } catch {
        return null;
      }
      if (err && (err.type || err.text || err.fields)) {
        console.error(
          `[/api/portal/appointments/cancel] ${label} — parsed`,
          "| type:", err.type,
          "| text:", err.text,
          "| fields:", JSON.stringify(err.fields ?? []),
        );
      }
      return err;
    };

    let updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload) });
    let updText = await updRes.text();
    let updErr  = updRes.ok ? null : logEzyvetError("v1 PATCH failed", updRes.status, updText);
    if (updRes.ok) console.log("[/api/portal/appointments/cancel] v1 PATCH status:", updRes.status, updText);

    if (!updRes.ok && updErr?.type !== "InternalException" && updText.includes("unknown or unsupported")) {
      console.log("[/api/portal/appointments/cancel] PATCH unsupported — trying PUT");
      updRes  = await fetch(`${base}/v1/appointment/${appointment_id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) });
      updText = await updRes.text();
      updErr  = updRes.ok ? null : logEzyvetError("v1 PUT failed", updRes.status, updText);
      if (updRes.ok) console.log("[/api/portal/appointments/cancel] v1 PUT status:", updRes.status, updText);
    }

    if (!updRes.ok) {
      const r = NextResponse.json({ error: "Failed to cancel appointment", detail: updErr ?? updText }, { status: 502 });
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
