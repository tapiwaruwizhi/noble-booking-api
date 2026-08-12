// src/lib/ezyvet/attachments.js
//
// Helper for uploading and retrieving ezyVet Attachments.
// Used ONLY for Animal photos — attachments are clinical-record files
// (record_type + record_id), so this is not used for branch/service/vet images
// (those stay on CDN URLs — see startup/route.js).
//
// Per ezyVet docs, POST /v1/attachment expects multipart/form-data with:
//   record_type (string, required)  — e.g. "Animal"
//   record_id   (number, required)
//   notes       (string, optional)
//   file_data   (binary, the actual file)
//   file_id     (string, alternative to file_data — reuse an existing ezyVet file)

import { getAccessToken } from "./auth";

const BASE = process.env.EZYVET_BASE_URL;

/**
 * Upload a base64-encoded image as an Attachment linked to an Animal record.
 * @param {string} animalId - numeric animal id
 * @param {string} base64Data - raw base64 (no data: prefix)
 * @param {string} fileName - e.g. "rex.jpg"
 * @param {string} contentType - "image/jpeg" | "image/png"
 */
export async function uploadAnimalPhoto(animalId, base64Data, fileName, contentType = "image/jpeg") {
  const token = await getAccessToken();

  // Convert base64 → binary Blob for the multipart file field
  const buffer = Buffer.from(base64Data, "base64");
  const blob   = new Blob([buffer], { type: contentType });

  const form = new FormData();
  form.append("record_type", "Animal");
  form.append("record_id", String(animalId));
  form.append("file_data", blob, fileName);

  console.log("[attachments] Uploading — animal:", animalId, "| file:", fileName, "| size:", buffer.length, "bytes");

  const res  = await fetch(`${BASE}/v1/attachment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // NOTE: do NOT set Content-Type manually — fetch sets the correct
      // multipart/form-data boundary automatically when given a FormData body.
    },
    body: form,
  });

  const text = await res.text();
  console.log("[attachments] upload status:", res.status, text.slice(0, 500));

  if (!res.ok) {
    console.error("[attachments] upload failed:", res.status, text);
    throw new Error(`Attachment upload failed: ${res.status} — ${text}`);
  }

  const data = JSON.parse(text);
  const attachment = data.items?.[0]?.attachment ?? data.attachment;
  return attachment; // { id, uid, record_type, record_id, ... }
}

/**
 * Fetch the attachment metadata list for a given Animal.
 */
export async function listAnimalAttachments(animalId) {
  const token = await getAccessToken();
  const res   = await fetch(
    `${BASE}/v1/attachment?record_type=Animal&record_id=${animalId}&active=1&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error("[attachments] list failed:", res.status, text);
    return [];
  }
  const data = JSON.parse(text);
  return (data.items ?? []).map(i => i.attachment ?? i);
}

/**
 * Download the actual file bytes for a given attachment id.
 * Returns a Buffer + content-type, or null if not found.
 */
export async function downloadAttachment(attachmentId) {
  const token = await getAccessToken();
  const res   = await fetch(`${BASE}/v1/attachment/download/${attachmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("[attachments] download failed:", res.status);
    return null;
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/**
 * Convenience: get the first active photo attachment for an animal, or null.
 */
export async function getAnimalPhotoAttachment(animalId) {
  const attachments = await listAnimalAttachments(animalId);
  const photo = attachments.find(a =>
    (a.content_type ?? a.file_type ?? "").startsWith("image")
  );
  return photo ?? null;
}