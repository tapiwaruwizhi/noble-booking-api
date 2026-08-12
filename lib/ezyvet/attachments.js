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
  const url = `${BASE}/v1/attachment?record_type=Animal&record_id=${animalId}&active=1&limit=20`;
  console.log("[attachments] Listing attachments:", url);

  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  console.log("[attachments] list status:", res.status);
  console.log("[attachments] list response:", text.slice(0, 1000));

  if (!res.ok) {
    console.error("[attachments] list failed:", res.status, text);
    return [];
  }
  const data = JSON.parse(text);
  const items = (data.items ?? []).map(i => i.attachment ?? i);
  console.log("[attachments] parsed", items.length, "attachment(s) for animal", animalId);
  if (items.length > 0) console.log("[attachments] first item keys:", Object.keys(items[0]));
  return items;
}

/**
 * Download the actual file bytes for a given attachment, using the
 * file_download_url ezyVet returns directly on the attachment record.
 * (Confirmed field — no need to guess a separate download endpoint.)
 */
export async function downloadAttachmentFromUrl(fileDownloadUrl) {
  const token = await getAccessToken();
  console.log("[attachments] Downloading from:", fileDownloadUrl);
  const res   = await fetch(fileDownloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("[attachments] download response status:", res.status);
  if (!res.ok) {
    const errText = await res.text().catch(() => "(could not read body)");
    console.error("[attachments] download failed:", res.status, fileDownloadUrl, "| body:", errText.slice(0, 500));
    return null;
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/**
 * Legacy path-based download — kept as a fallback only. Prefer
 * downloadAttachmentFromUrl() with the attachment's own file_download_url.
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
 * Convenience: get the animal's primary photo attachment.
 * Prefers the one flagged primary_image === "1"; falls back to the most
 * recently created attachment if no primary is set.
 */
export async function getAnimalPhotoAttachment(animalId) {
  const attachments = await listAnimalAttachments(animalId);
  if (attachments.length === 0) return null;

  const primary = attachments.find(a => a.primary_image === "1" || a.primary_image === 1 || a.primary_image === true);
  if (primary) {
    console.log("[attachments] Using primary_image attachment for animal", animalId, ":", primary.id);
    return primary;
  }

  const sorted = [...attachments].sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
  console.log("[attachments] No primary_image flagged — using most recent for animal", animalId, ":", sorted[0].id);
  return sorted[0];
}