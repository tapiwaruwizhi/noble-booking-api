// src/app/api/animal-photo/route.js
//
// POST /api/animal-photo   { animal_id, image_base64, file_name, content_type }
//   → uploads photo as an ezyVet Attachment linked to the animal, returns attachment id
//
// GET /api/animal-photo?animal_id=123
//   → returns { photo_url: "/api/animal-photo/download?id=X" } or { photo_url: null }
//
// GET /api/animal-photo/download?id=X  (separate route below handles the actual bytes)

import { NextResponse } from "next/server";
import { uploadAnimalPhoto, getAnimalPhotoAttachment } from "../../../lib/ezyvet/attachments";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";

export async function POST(req) {
  try {
    const { animal_id, image_base64, file_name, content_type } = await req.json();

    if (!animal_id || !image_base64) {
      return NextResponse.json({ error: "animal_id and image_base64 are required" }, { status: 400 });
    }

    console.log("[/api/animal-photo] Uploading photo for animal:", animal_id);

    const attachment = await uploadAnimalPhoto(
      animal_id,
      image_base64,
      file_name ?? `animal_${animal_id}.jpg`,
      content_type ?? "image/jpeg"
    );

    console.log("[/api/animal-photo] Uploaded — attachment id:", attachment?.id);

    const r = NextResponse.json({
      success: true,
      attachment_id: attachment?.id,
      photo_url: `/api/animal-photo/download?id=${attachment?.id}`,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/animal-photo] POST error:", err);
    return NextResponse.json({ error: "Failed to upload photo", detail: err.message }, { status: 502 });
  }
}

export async function GET(req) {
  try {
    const animalId = new URL(req.url).searchParams.get("animal_id");
    if (!animalId) {
      return NextResponse.json({ error: "animal_id is required" }, { status: 400 });
    }

    const photo = await getAnimalPhotoAttachment(animalId);

    const r = NextResponse.json({
      photo_url: photo ? `/api/animal-photo/download?id=${photo.id}` : null,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/animal-photo] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch photo", detail: err.message }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}