// src/app/api/portal/pets/route.js
// GET — returns all pets belonging to the logged-in contact.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { getAnimalPhotoAttachment } from "@/lib/ezyvet/attachments";

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

    const pets = await Promise.all((aData.items ?? []).map(async i => {
      const a   = i.animal ?? i;
      const dob = a.date_of_birth ? new Date(a.date_of_birth * 1000) : null;

      // Photo lookup is best-effort — never let it block the pet list from loading
      let photo_url = null;
      try {
        const attachment = await getAnimalPhotoAttachment(a.id);
        if (attachment) photo_url = `/api/animal-photo/download?url=${encodeURIComponent(attachment.file_download_url)}`;
      } catch (err) {
        console.log("[/api/portal/pets] photo lookup failed for animal", a.id, ":", err.message);
      }

      return {
        id:              a.id,
        uid:             a.uid,
        name:            a.name,
        species:         a.species_name,
        species_id:      a.species_id,
        breed:           a.breed_name,
        breed_id:        a.breed_id,
        sex:             a.sex_name,
        sex_id:          a.sex_id,
        colour:          a.colour_name,
        colour_id:       a.animalcolour_id,
        microchip_number: a.microchip_number || null,
        weight:          a.weight || null,
        weight_unit:     a.weight_unit || "kg",
        photo_url,
        age:     dob ? `${Math.max(0, Math.floor((Date.now() - dob) / 31_536_000_000))} years` : "Unknown",
        dob:     dob ? dob.toISOString().split("T")[0] : null,
      };
    }));

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

// ── POST — create a new pet for the logged-in contact ───────────────────────
export async function POST(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { name, species_id, breed_id, sex_id, colour_id, dob } = await req.json();
    if (!name) {
      const r = NextResponse.json({ error: "name is required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const payload = {
      name,
      contact_id: session.contactId,
      active:     1,
    };
    if (species_id) payload.species_id      = Number(species_id);
    if (breed_id)   payload.breed_id        = Number(breed_id);
    if (sex_id)     payload.sex_id          = Number(sex_id);
    if (colour_id)  payload.animalcolour_id = Number(colour_id);
    if (dob)        payload.date_of_birth   = Math.floor(new Date(dob).getTime() / 1000);

    console.log("[/api/portal/pets POST] Creating pet:", JSON.stringify(payload));

    const aRes  = await fetch(`${base}/v1/animal`, { method: "POST", headers, body: JSON.stringify(payload) });
    const aText = await aRes.text();
    console.log("[/api/portal/pets POST] status:", aRes.status, aText);

    if (!aRes.ok) {
      const r = NextResponse.json({ error: "Failed to create pet", detail: aText }, { status: 502 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const aData = JSON.parse(aText);
    const a = aData.items?.[0]?.animal ?? aData.animal;

    const r = NextResponse.json({ success: true, pet: { id: a?.id, uid: a?.uid, name } });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pets POST] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

// ── PATCH — update an existing pet, only if it belongs to the logged-in contact
export async function PATCH(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { animal_id, name, species_id, breed_id, sex_id, colour_id, dob } = await req.json();
    if (!animal_id) {
      const r = NextResponse.json({ error: "animal_id is required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers      = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const patchHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/merge-patch+json" };

    // ── Ownership check — never let a client edit another client's pet ──────
    const checkRes  = await fetch(`${base}/v2/animal?id=${animal_id}&limit=1`, { headers });
    const checkData = await checkRes.json();
    const existing  = checkData.items?.[0]?.animal ?? checkData.animal;

    if (!existing || String(existing.contact_id) !== String(session.contactId)) {
      console.warn("[/api/portal/pets PATCH] Ownership check failed — animal_id:", animal_id, "session contact:", session.contactId, "animal contact:", existing?.contact_id);
      const r = NextResponse.json({ error: "Pet not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const payload = {};
    if (name)       payload.name             = name;
    if (species_id) payload.species_id       = Number(species_id);
    if (breed_id)   payload.breed_id         = Number(breed_id);
    if (sex_id)     payload.sex_id           = Number(sex_id);
    if (colour_id)  payload.animalcolour_id  = Number(colour_id);
    if (dob)        payload.date_of_birth    = Math.floor(new Date(dob).getTime() / 1000);

    console.log("[/api/portal/pets PATCH] Updating animal_id:", animal_id, "payload:", JSON.stringify(payload));

    let updRes  = await fetch(`${base}/v1/animal/${animal_id}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload) });
    let updText = await updRes.text();
    console.log("[/api/portal/pets PATCH] v1 PATCH status:", updRes.status, updText);

    if (!updRes.ok && updText.includes("unknown or unsupported")) {
      console.log("[/api/portal/pets PATCH] PATCH unsupported — trying PUT");
      updRes  = await fetch(`${base}/v1/animal/${animal_id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
      updText = await updRes.text();
      console.log("[/api/portal/pets PATCH] v1 PUT status:", updRes.status, updText);
    }

    if (!updRes.ok) {
      const r = NextResponse.json({ error: "Failed to update pet", detail: updText }, { status: 502 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const r = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pets PATCH] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}