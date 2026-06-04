import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";

const CORS = process.env.ALLOWED_ORIGIN ?? "*";
const EMAIL_TYPE = 1;
const PHONE_TYPE = 3;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.toLowerCase();
    if (!email)
      return NextResponse.json({ error: "email required" }, { status: 400 });

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    // ── Paginate through contacts matching email in contact_detail_list ──────
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

      // Stop if no more pages
      if (items.length === 0) break;

      // Find contact whose contact_detail_list contains the email
      const found = items.find(i => {
        const c = i.contact ?? i;
        return (c.contact_detail_list ?? []).some(
          d => d.type_id === EMAIL_TYPE &&
               d.value?.toLowerCase() === email
        );
      });

      if (found) {
        contact = found.contact ?? found;
        break;
      }

      // Stop if we've reached the last page
      if (items.length < limit) break;
      page++;
    }

    if (!contact) {
      const r = NextResponse.json({ found: false, contact: null, animals: [] });
      r.headers.set("Access-Control-Allow-Origin", CORS);
      return r;
    }

    // ── Fetch animals for this contact ───────────────────────────────────────
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
        name:    a.name,
        species: a.species_name,
        breed:   a.breed_name,
        age:     dob
          ? `${Math.max(0, Math.floor((Date.now() - dob) / 31_536_000_000))} years`
          : "Unknown",
      };
    });

    // Extract email and phone for display
    const detailList    = contact.contact_detail_list ?? [];
    const email_address = detailList.find(d => d.type_id === EMAIL_TYPE)?.value ?? email;
    const phone_number  = detailList.find(d => d.type_id === PHONE_TYPE)?.value ?? "";

    const r = NextResponse.json({
      found: true,
      contact: {
        id:         contact.id,
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
      "Access-Control-Allow-Origin":  process.env.ALLOWED_ORIGIN ?? "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}