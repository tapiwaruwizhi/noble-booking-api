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

    const parts = [a.street_1, a.street_2, a.suburb, a.city, a.state, a.postcode]
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch (err) {
    console.error("[ezyvetAddress] error resolving address", addressId, err);
    return null;
  }
}