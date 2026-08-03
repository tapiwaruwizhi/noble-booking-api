// src/app/api/portal/pets/route.js
// GET — returns all pets belonging to the logged-in contact.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    const aRes  = await fetch(`${base}/v2/animal?active=1&contact_id=${session.contactId}&limit=50`, { headers });
    const aData = await aRes.json();

    const pets = (aData.items ?? []).map(i => {
      const a   = i.animal ?? i;
      const dob = a.date_of_birth ? new Date(a.date_of_birth * 1000) : null;
      return {
        id:      a.id,
        uid:     a.uid,
        name:    a.name,
        species: a.species_name,
        breed:   a.breed_name,
        sex:     a.sex_name,
        colour:  a.colour_name,
        age:     dob ? `${Math.max(0, Math.floor((Date.now() - dob) / 31_536_000_000))} years` : "Unknown",
        dob:     dob ? dob.toISOString().split("T")[0] : null,
      };
    });

    const r = NextResponse.json({ pets });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pets] error:", err);
    const r = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    Object.entries(getCredentialedCorsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}