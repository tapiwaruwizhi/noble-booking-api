// src/app/api/admin/service-image/route.js
//
// Admin-only endpoint for uploading service/appointment-type images.
// Uses Vercel Blob (NOT ezyVet attachments) since these are branding
// images, not clinical records — see attachments.js header comment for why.
//
// POST /api/admin/service-image
//   FormData: { file: <image>, service_uid: "appointmentType_xxx", admin_key: "..." }
//   → uploads to Vercel Blob, returns public URL
//
// Requires `npm install @vercel/blob` and a BLOB_READ_WRITE_TOKEN env var
// (auto-provisioned when you enable Vercel Blob storage on your project).

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const CORS      = process.env.ALLOWED_ORIGIN ?? "*";
const ADMIN_KEY = process.env.ADMIN_UPLOAD_KEY; // set this in Vercel env vars

export async function POST(req) {
  try {
    const formData    = await req.formData();
    const file         = formData.get("file");
    const serviceUid   = formData.get("service_uid");
    const providedKey  = formData.get("admin_key");

    // ── Simple admin auth — swap for real auth later if needed ──────────────
    if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!file || !serviceUid) {
      return NextResponse.json({ error: "file and service_uid are required" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, or WEBP images allowed" }, { status: 400 });
    }

    const ext      = file.type.split("/")[1];
    const filename = `services/${serviceUid}.${ext}`;

    console.log("[/api/admin/service-image] Uploading:", filename);

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false, // overwrite existing image for this service
    });

    console.log("[/api/admin/service-image] Uploaded to:", blob.url);

    const r = NextResponse.json({
      success:     true,
      service_uid: serviceUid,
      image_url:   blob.url,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/admin/service-image] error:", err);
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