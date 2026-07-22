// src/app/api/admin/upload-image/route.js
//
// Generic admin image uploader — Vercel Blob (NOT ezyVet attachments).
// Handles three categories:
//   "service"  — appointment type images     → services/{uid}.ext
//   "location" — branch/separation photos    → locations/{separationId}.ext
//   "doctor"   — vet/resource photos          → doctors/{resourceUid}.ext
//
// POST /api/admin/upload-image
//   FormData: { file, category: "service"|"location"|"doctor", item_id, admin_key }

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const CORS      = process.env.ALLOWED_ORIGIN ?? "*";
const ADMIN_KEY = process.env.ADMIN_UPLOAD_KEY;

const CATEGORY_FOLDERS = {
  service:  "services",
  location: "locations",
  doctor:   "doctors",
};

export async function POST(req) {
  try {
    const formData   = await req.formData();
    const file        = formData.get("file");
    const category    = formData.get("category");
    const itemId      = formData.get("item_id");
    const providedKey = formData.get("admin_key");

    console.log("[/api/admin/upload-image] category:", category, "item_id:", itemId);
    console.log("[/api/admin/upload-image] ADMIN_KEY set?", !!ADMIN_KEY, "| keys match?", providedKey === ADMIN_KEY);

    if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folder = CATEGORY_FOLDERS[category];
    if (!folder) {
      return NextResponse.json({ error: "category must be one of: service, location, doctor" }, { status: 400 });
    }

    if (!file || !itemId) {
      return NextResponse.json({ error: "file and item_id are required" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, or WEBP images allowed" }, { status: 400 });
    }

    const ext      = file.type.split("/")[1];
    const filename = `${folder}/${itemId}.${ext}`;

    console.log("[/api/admin/upload-image] Uploading:", filename);

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false, // overwrite any existing image for this item
    });

    console.log("[/api/admin/upload-image] Uploaded to:", blob.url);

    const r = NextResponse.json({
      success:   true,
      category,
      item_id:   itemId,
      image_url: blob.url,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/admin/upload-image] error:", err);
    return NextResponse.json({ error: "Upload failed", detail: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}