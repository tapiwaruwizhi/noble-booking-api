
// ═══════════════════════════════════════════════════════════════════════════════
// FILE: src/app/api/contact/route.js
// GET /api/contact?email=user@example.com
//
// 1. Look up contact by email via GET /v2/contact
// 2. If found, fetch their animals via GET /v2/animal?contact_id=X
// 3. Return { found, contact, animals }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
// import { getAccessToken } from "@/lib/ezyvet/auth";
import { getAccessToken } from "../../../lib/ezyvet/auth";



export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── 1. Look up contact ──────────────────────────────────────────────────
    const contactRes = await fetch(
      `${base}/v2/contact?active=1&email=${encodeURIComponent(email)}&limit=1`,
      { headers }
    );
    const contactData = await contactRes.json();
    const contacts    = contactData.items ?? [];

    if (contacts.length === 0) {
      return NextResponse.json({ found: false, contact: null, animals: [] });
    }

    const contact = contacts[0].contact;

    // ── 2. Fetch their animals ──────────────────────────────────────────────
    const animalRes = await fetch(
      `${base}/v2/animal?active=1&contact_id=${contact.id}&limit=20`,
      { headers }
    );
    const animalData = await animalRes.json();
    const animals    = (animalData.items ?? []).map(i => ({
      id:      i.animal.id,
      name:    i.animal.name,
      species: i.animal.species_name,
      breed:   i.animal.breed_name,
      age:     i.animal.date_of_birth
        ? `${Math.floor((Date.now() - new Date(i.animal.date_of_birth * 1000)) / 31_536_000_000)} years`
        : "Unknown",
    }));

    return NextResponse.json({
      found: true,
      contact: {
        id:         contact.id,
        first_name: contact.first_name,
        last_name:  contact.last_name,
        email:      contact.email,
        phone:      contact.phone,
      },
      animals,
    });

  } catch (err) {
    console.error("[/api/contact]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}