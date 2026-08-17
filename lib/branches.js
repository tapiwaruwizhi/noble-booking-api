// src/lib/branches.js
//
// Shared branch/location data — pulled out of app/api/startup/route.js so
// other routes (e.g. portal/appointments, for "Directions" links) can use
// the same address book without duplicating it.
//
// realName = Noble Vet's public branch name (shown in UI prefix)
// ezyVet separation name is kept and shown in brackets after e.g. "(Department A)"
//
// googleLink = an exact Google Maps share/place link for this branch (paste the
// URL from the "Share" button on the branch's Google Maps listing). When set,
// this is used as-is for "Directions" instead of building a text search from
// `address` — more precise (pins the exact listing, not just a search guess).
// Leave null to fall back to an address-based search link (see getDirectionsUrl).
export const BRANCH_MAP = {
  1: {
    realName:   "Dubai Investment Park (DIP)",
    photo:      "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:    "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:      "8am – 9pm daily",
    googleLink: "https://maps.app.goo.gl/QqBtAKX73HpHmBbT7",
  },
  4: {
    realName:   "Jumeirah",
    photo:      "https://framerusercontent.com/images/lqrR41VkWauKj02z17JplcKOs.webp?width=800",
    address:    "Villa 63 Umm Al Sheif St - Jumeirah - Jumeira Third - Dubai",
    hours:      "Mon–Fri 8am–8pm · Sat–Sun 9am–6pm",
    googleLink: "https://maps.app.goo.gl/9duqBZRJjerM5G8Z7",
  },
  5: {
    realName:   "Jumeirah Lake Towers (JLT)",
    photo:      "https://framerusercontent.com/images/hPLBXv621QKLaSk5kWzR88tvB9k.webp?width=800",
    address:    "Retail R3A, Lake Point Tower, Cluster N, JLT",
    hours:      "10am – 7pm daily",
    googleLink: "https://maps.app.goo.gl/9duqBZRJjerM5G8Z7",
  },
  9: {
    realName:   "Sports City",
    photo:      "https://framerusercontent.com/images/TV5pz7Ult5uD58sxDq18jVWDDI.webp?width=800",
    address:    "Shop 1, Canal Residence West, Dubai Sports City",
    hours:      "Call for hours",
    googleLink: "https://maps.app.goo.gl/9duqBZRJjerM5G8Z7",
  },
  11: {
    realName:   "Sustainable City",
    photo:      "https://framerusercontent.com/images/Om0XtUe6bUMiRMKb0bfUkXGPjCo.webp?width=800",
    address:    "Sustainable City Plaza, Off Al Qudra Rd, Dubailand",
    hours:      "Call for hours",
    googleLink: "https://maps.app.goo.gl/B2Ks7B7xo5PhSEj66",
  },
  13: {
    realName:   "Dubai Investment Park (DIP)",
    photo:      "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:    "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:      "8am – 9pm daily",
    googleLink: "https://maps.app.goo.gl/Po3PcLeuFi8RRFKs7",
  },
  // Add production separation IDs here when going live
};

export const FALLBACK_BRANCH = {
  realName:   null,
  photo:      null, // replaced by Vercel Blob "locations/default.jpg" at runtime — see getBlobOverrides
  address:    "Dubai, UAE",
  hours:      "Call +971 600 566 253",
  googleLink: null,
};

export function getBranch(id) {
  return BRANCH_MAP[id] ?? FALLBACK_BRANCH;
}

// Google Maps "search" deep link — works for both app and web, no API key needed,
// and degrades gracefully to a plain text search if the address is imprecise.
export function directionsUrl(address) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Preferred "Directions" link for a branch — uses the branch's exact
// `googleLink` when one has been set, otherwise falls back to a text search
// built from its address.
export function getDirectionsUrl(branch) {
  if (!branch) return null;
  return branch.googleLink || directionsUrl(branch.address);
}
