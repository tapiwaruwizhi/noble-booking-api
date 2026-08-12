// src/lib/ezyvetAddress.js
//
// Resolves an ezyVet address_physical/address_postal ID (a numeric FK on
// the contact record) into a readable string. These IDs point to a
// separate Address entity, not embedded fields.

export async function resolveAddress(base, headers, addressId) {
  if (!addressId) return null;
  try {
    const res  = await fetch(`${base}/v1/address/${addressId}`, { headers });
    const text = await res.text();
    if (!res.ok) {
      console.log("[ezyvetAddress] lookup failed for id", addressId, ":", res.status, text);
      return null;
    }
    const data = JSON.parse(text);
    const a = data.items?.[0]?.address ?? data.address;
    if (!a) return null;

    return {
      id:       a.id,
      street_1: a.street_1 || "",
      street_2: a.street_2 || "",
      suburb:   a.suburb   || "",
      city:     a.city     || "",
      state:    a.state    || "",
      postcode: a.postcode || "",
      display:  [a.street_1, a.street_2, a.suburb, a.city, a.state, a.postcode].filter(Boolean).join(", "),
    };
  } catch (err) {
    console.error("[ezyvetAddress] error resolving address", addressId, err);
    return null;
  }
}

/**
 * Update an existing address record. Requires the address already exists
 * (has an id) — creating a brand-new address for a contact that has none
 * yet is not handled here.
 */
export async function updateAddress(base, patchHeaders, jsonHeaders, addressId, fields) {
  const payload = {};
  if (fields.street_1 !== undefined) payload.street_1 = fields.street_1;
  if (fields.street_2 !== undefined) payload.street_2 = fields.street_2;
  if (fields.suburb   !== undefined) payload.suburb   = fields.suburb;
  if (fields.city     !== undefined) payload.city     = fields.city;
  if (fields.state    !== undefined) payload.state    = fields.state;
  if (fields.postcode !== undefined) payload.postcode = fields.postcode;

  console.log("[ezyvetAddress] Updating address id:", addressId, "payload:", JSON.stringify(payload));

  let res  = await fetch(`${base}/v1/address/${addressId}`, {
    method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload),
  });
  let text = await res.text();
  console.log("[ezyvetAddress] v1 PATCH status:", res.status, text);

  if (!res.ok && text.includes("unknown or unsupported")) {
    console.log("[ezyvetAddress] PATCH unsupported — trying PUT");
    res  = await fetch(`${base}/v1/address/${addressId}`, {
      method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload),
    });
    text = await res.text();
    console.log("[ezyvetAddress] v1 PUT status:", res.status, text);
  }

  return { ok: res.ok, text };
}