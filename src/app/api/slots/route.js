
// ═══════════════════════════════════════════════════════════════════════════════
// FILE: src/app/api/slots/route.js
// GET /api/slots?date=2026-06-10&appt_type_uid=appointmentType_xxx&resource_uid=resource_xxx
//
// Queries /ezycab/availability and returns bookable slots
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date          = searchParams.get("date");           // YYYY-MM-DD
    const apptTypeUid   = searchParams.get("appt_type_uid");  // appointmentType_xxx
    const resourceUid   = searchParams.get("resource_uid");   // resource_xxx
    const duration      = searchParams.get("duration") ?? "30";

    if (!date || !apptTypeUid || !resourceUid) {
      return NextResponse.json(
        { error: "date, appt_type_uid, and resource_uid are required" },
        { status: 400 }
      );
    }

    const token     = await getAccessToken();
    const ezyCABBase = process.env.EZYVET_EZYCAB_BASE_URL;

    const params = new URLSearchParams({
      "resources[]":                        resourceUid,
      "dates[]":                            date,
      duration,
      "filter[slots.available][eq]":        "true",
      "filter[slots.appointmentType.id][in]": apptTypeUid,
    });

    const res  = await fetch(`${ezyCABBase}/availability?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[/api/slots] ezyVet error:", res.status, body);
      return NextResponse.json({ error: "Failed to fetch availability" }, { status: 502 });
    }

    const data  = await res.json();
    const slots = (data.slots ?? data.items ?? []).map(slot => ({
      start_time:       slot.start_time,
      end_time:         slot.end_time,
      appointment_types: slot.appointment_types ?? [],
      // Format for display: "09:00"
      label: new Date(slot.start_time * 1000).toLocaleTimeString("en-AE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Dubai",
      }),
    }));

    return NextResponse.json({ slots });

  } catch (err) {
    console.error("[/api/slots]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

