// src/lib/appointmentStatus.js
//
// Resolves ezyVet appointment_status_id → human-readable label
// (e.g. "Unconfirmed", "Confirmed", "Arrived", "Completed", "Cancelled").
//
// ezyVet exposes this as a lookup table, not a fixed enum, so IDs vary
// per ezyVet instance/site. This fetches it once per request (cheap, small
// table) rather than hardcoding IDs that may not match your sandbox.

export async function getAppointmentStatusMap(base, headers) {
  try {
    const res  = await fetch(`${base}/v2/appointmentstatus?active=1&limit=50`, { headers });
    const text = await res.text();
    console.log("[appointmentStatus] fetch status:", res.status);

    if (!res.ok) {
      console.log("[appointmentStatus] v2 failed, trying v1:", text);
      const res1  = await fetch(`${base}/v1/appointmentstatus?active=1&limit=50`, { headers });
      const text1 = await res1.text();
      if (!res1.ok) {
        console.log("[appointmentStatus] v1 also failed:", text1);
        return {};
      }
      return buildMap(JSON.parse(text1));
    }

    return buildMap(JSON.parse(text));
  } catch (err) {
    console.error("[appointmentStatus] error:", err);
    return {};
  }
}

function buildMap(data) {
  const map = {};
  for (const i of data.items ?? []) {
    const s = i.appointmentstatus ?? i;
    if (s.id != null) map[s.id] = s.name ?? s.description ?? `Status ${s.id}`;
  }
  console.log("[appointmentStatus] resolved map:", JSON.stringify(map));
  return map;
}