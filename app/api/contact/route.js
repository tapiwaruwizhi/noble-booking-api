// src/app/api/contact/route.js
// GET /api/contact?email=X  or  GET /api/contact?phone=X
//
// Searches contacts by matching against embedded contact_detail_list.
// type_id 1 = email, type_id 3 = phone/mobile
// Paginates through contacts 200 at a time until a match is found.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS       = process.env.ALLOWED_ORIGIN ?? "*";
const EMAIL_TYPE = 1;
const PHONE_TYPE = 3;

const normalizePhone = (val = "") => val.replace(/[\s\-().+]/g, "");

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const phone = searchParams.get("phone")?.trim();

    if (!email && !phone)
      return NextResponse.json({ error: "email or phone required" }, { status: 400 });

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    let contact = null;
    let page    = 1;
    const limit = 200;

    while (!contact) {
      const res  = await fetch(
        `${base}/v2/contact?active=true&is_customer=true&limit=${limit}&page=${page}`,
        { headers }
      );
      const data  = await res.json();
      const items = data.items ?? [];
      if (items.length === 0) break;

      const found = items.find(i => {
        const c       = i.contact ?? i;
        const details = c.contact_detail_list ?? [];

        if (email) {
          const emailMatch = details.some(
            d => d.type_id === EMAIL_TYPE &&
                 d.value?.trim().toLowerCase() === email
          );
          if (emailMatch) return true;
        }

        if (phone) {
          const normalizedInput = normalizePhone(phone);
          const phoneMatch = details.some(
            d => d.type_id === PHONE_TYPE &&
                 normalizePhone(d.value) === normalizedInput
          );
          if (phoneMatch) return true;
        }

        return false;
      });

      if (found) { contact = found.contact ?? found; break; }
      if (items.length < limit) break;
      page++;
    }

    if (!contact) {
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    const aRes    = await fetch(
      `${base}/v2/animal?active=1&contact_id=${contact.id}&limit=20`,
      { headers }
    );
    const aData   = await aRes.json();
    const animals = (aData.items ?? []).map(i => {
      const a   = i.animal ?? i;
      const dob = a.date_of_birth ? new Date(a.date_of_birth * 1000) : null;
      return {
        id:      a.id,
        uid:     a.uid,
        name:    a.name,
        species: a.species_name,
        breed:   a.breed_name,
        age:     dob
          ? `${Math.max(0, Math.floor((Date.now() - dob) / 31_536_000_000))} years`
          : "Unknown",
      };
    });

    const detailList    = contact.contact_detail_list ?? [];
    const email_address = detailList.find(d => d.type_id === EMAIL_TYPE)?.value ?? email ?? "";
    const phone_number  = detailList.find(d => d.type_id === PHONE_TYPE)?.value ?? phone ?? "";

    const r = NextResponse.json({
      found: true,
      contact: {
        id:         contact.id,
        uid:        contact.uid,
        first_name: contact.first_name,
        last_name:  contact.last_name,
        email:      email_address,
        phone:      phone_number,
      },
      animals,
    });
    r.headers.set("Access-Control-Allow-Origin", CORS);
    return r;

  } catch (err) {
    console.error("[/api/contact]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}