// src/app/api/auth/me/route.js
// GET — returns the logged-in contact's profile, or 401 if not logged in.
// Fetches fresh data from ezyVet each time (not just what's in the session token).

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    const cRes  = await fetch(`${base}/v2/contact?id=${session.contactId}&limit=1`, { headers });
    const cData = await cRes.json();
    const contact = cData.items?.[0]?.contact ?? cData.contact;

    if (!contact) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const EMAIL_TYPE = 1, PHONE_TYPE = 3;
    const details = contact.contact_detail_list ?? [];
    const getTypeId = (d) => Number(d.contact_detail_type_id ?? d.type_id ?? 0);
    const email = details.find(d => getTypeId(d) === EMAIL_TYPE)?.value ?? "";
    const phone = details.find(d => getTypeId(d) === PHONE_TYPE)?.value ?? "";

    const r = NextResponse.json({
      contact: {
        id:         contact.id,
        uid:        contact.uid,
        first_name: contact.first_name,
        last_name:  contact.last_name,
        email,
        phone,
      },
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/auth/me] error:", err);
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