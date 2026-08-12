// src/app/api/portal/pet-photo/route.js
// POST { animal_id, image_base64, file_name, content_type }
//
// Uploads a pet photo as an ezyVet Attachment, but only after verifying
// the animal belongs to the logged-in contact — same ownership check
// pattern used in /api/portal/pets PATCH.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { uploadAnimalPhoto } from "@/lib/ezyvet/attachments";

export async function POST(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const { animal_id, image_base64, file_name, content_type } = await req.json();
    if (!animal_id || !image_base64) {
      const r = NextResponse.json({ error: "animal_id and image_base64 are required" }, { status: 400 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── Ownership check ───────────────────────────────────────────────────
    const checkRes  = await fetch(`${base}/v2/animal?id=${animal_id}&limit=1`, { headers });
    const checkData = await checkRes.json();
    const existing  = checkData.items?.[0]?.animal ?? checkData.animal;

    if (!existing || String(existing.contact_id) !== String(session.contactId)) {
      console.warn("[/api/portal/pet-photo] Ownership check failed — animal_id:", animal_id);
      const r = NextResponse.json({ error: "Pet not found" }, { status: 404 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    console.log("[/api/portal/pet-photo] Uploading photo for animal:", animal_id);

    const attachment = await uploadAnimalPhoto(
      animal_id,
      image_base64,
      file_name ?? `animal_${animal_id}.jpg`,
      content_type ?? "image/jpeg"
    );

    console.log("[/api/portal/pet-photo] ✓ Uploaded — attachment id:", attachment?.id);
    if (!attachment?.file_download_url) {
      console.log("[/api/portal/pet-photo] Note: file_download_url not present in create response (fields:", Object.keys(attachment ?? {}), ") — the frontend refetches the pet list afterward, which uses the confirmed GET listing shape instead.");
    }

    const r = NextResponse.json({
      success:       true,
      attachment_id: attachment?.id,
      photo_url:     attachment?.file_download_url ? `/api/animal-photo/download?url=${encodeURIComponent(attachment.file_download_url)}` : null,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/pet-photo] error:", err);
    const r = NextResponse.json({ error: "Failed to upload photo", detail: err.message }, { status: 502 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}