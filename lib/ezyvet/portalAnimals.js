// src/lib/portalAnimals.js
//
// Shared "which animals belong to this contact?" lookup.
//
// Every per-animal portal route (standard of care, vaccinations, consults)
// needs this to enforce ownership — a client must never be able to read another
// client's animal records by guessing an animal_id. Pulled into one place so
// the ownership rule is written once rather than re-implemented per route.

/**
 * Returns the active animals belonging to a contact as
 * `[{ id, uid, name }]`. Returns [] on failure rather than throwing, so a
 * lookup blip degrades to "no records" instead of a 500.
 */
export async function getContactAnimals(base, headers, contactId) {
  try {
    const res = await fetch(
      `${base}/v2/animal?active=1&contact_id=${contactId}&limit=200`,
      { headers }
    );
    if (!res.ok) {
      console.log("[portalAnimals] animal lookup failed:", res.status, (await res.text()).slice(0, 300));
      return [];
    }
    const data = await res.json();
    return (data.items ?? []).map((i) => {
      const a = i.animal ?? i;
      return { id: a.id, uid: a.uid, name: a.name };
    }).filter((a) => a.id != null);
  } catch (err) {
    console.log("[portalAnimals] animal lookup threw:", err.message);
    return [];
  }
}

/** Convenience: just the numeric ids. */
export async function getContactAnimalIds(base, headers, contactId) {
  return (await getContactAnimals(base, headers, contactId)).map((a) => a.id);
}