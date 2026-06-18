// src/app/api/slots/route.js
// GET /api/slots?date=2026-06-19&appt_type_uid=appointmentType_xxx&resource_uid=resource_xxx
//
// Queries /availability (apiv2.trial.ezyvet.com) and returns bookable slots.
// Response is JSON:API shaped: data[0].attributes.slots[]
// Each slot has { start: ISO string, duration: minutes, available: bool }

import { NextResponse } from "next/server";
import { getAccessToken } from "../../../lib/ezyvet/auth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

// Booking-specific base URL (ezyCAB endpoints: /availability, /booking)
const BOOKING_BASE_URL = process.env.EZYVET_BOOKING_BASE_URL ?? "https://apiv2.trial.ezyvet.com";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date         = searchParams.get("date");          // YYYY-MM-DD
    const apptTypeUid  = searchParams.get("appt_type_uid");  // appointmentType_xxx
    const resourceUid  = searchParams.get("resource_uid");   // resource_xxx
    const duration     = searchParams.get("duration") ?? "15";

    if (!date || !apptTypeUid || !resourceUid) {
      return NextResponse.json(
        { error: "date, appt_type_uid, and resource_uid are required" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();

    const params = new URLSearchParams({
      "resources[]":                          resourceUid,
      "dates[]":                              date,
      duration:                               String(duration),
      "filter[slots.available][eq]":          "true",
      "filter[slots.appointmentType.id][in]": apptTypeUid,
    });

    const res = await fetch(`${BOOKING_BASE_URL}/availability?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[/api/slots] ezyVet error:", res.status, body);
      return NextResponse.json({ error: "Failed to fetch availability" }, { status: 502 });
    }

    const json = await res.json();

    // ── Parse the real JSON:API response shape ───────────────────────────────
    // json.data is an array, one entry per resource/date combo queried.
    // Each entry has .attributes.slots = [{ start, duration, available, relationships }]
    const rawSlots = (json.data ?? []).flatMap(entry => entry.attributes?.slots ?? []);

    const slots = rawSlots
      .filter(slot => slot.available)
      .map(slot => {
        const startDate = new Date(slot.start);
        const endDate   = new Date(startDate.getTime() + (slot.duration ?? 30) * 60_000);
        return {
          start_time: Math.floor(startDate.getTime() / 1000), // Unix seconds, for booking payload
          end_time:   Math.floor(endDate.getTime() / 1000),
          start_iso:  slot.start,                              // raw ISO, in case needed
          label: startDate.toLocaleTimeString("en-AE", {
            hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai",
          }),
        };
      });

    const r = NextResponse.json({ slots });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/slots]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}