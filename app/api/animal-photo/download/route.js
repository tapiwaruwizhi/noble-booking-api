// src/app/api/animal-photo/download/route.js
// GET /api/animal-photo/download?id=X
//
// Proxies the actual image bytes from ezyVet (which requires a bearer token)
// so the browser can load it as a plain <img src="..."> without auth.

import { downloadAttachment } from "../../../../lib/ezyvet/attachments";

export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const file = await downloadAttachment(id);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(file.buffer, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=86400", // cache 1 day — animal photos rarely change
    },
  });
}