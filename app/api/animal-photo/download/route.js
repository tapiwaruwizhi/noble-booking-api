// src/app/api/animal-photo/download/route.js
// GET /api/animal-photo/download?url=<encoded file_download_url>
//
// Proxies the actual image bytes from ezyVet (which requires a bearer token)
// so the browser can load it as a plain <img src="..."> without auth.
// Uses the file_download_url ezyVet returns directly on the attachment
// record — not a reconstructed path.

import { downloadAttachmentFromUrl } from "../../../../lib/ezyvet/attachments";

export async function GET(req) {
  const url = new URL(req.url).searchParams.get("url"); // already decoded by URLSearchParams
  if (!url) {
    console.log("[/api/animal-photo/download] Missing url param");
    return new Response("Missing url", { status: 400 });
  }

  console.log("[/api/animal-photo/download] Fetching:", url);

  const file = await downloadAttachmentFromUrl(url);
  if (!file) {
    console.log("[/api/animal-photo/download] downloadAttachmentFromUrl returned null — see [attachments] logs above for the actual ezyVet response status");
    return new Response("Not found", { status: 404 });
  }

  console.log("[/api/animal-photo/download] ✓ Got", file.buffer.length, "bytes, content-type:", file.contentType);

  return new Response(file.buffer, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=86400", // cache 1 day — animal photos rarely change
    },
  });
}