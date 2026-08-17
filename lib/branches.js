// src/lib/branches.js
//
// Shared branch/location data — pulled out of app/api/startup/route.js so
// other routes (e.g. portal/appointments, for "Directions" links) can use
// the same address book without duplicating it.
//
// realName = Noble Vet's public branch name (shown in UI prefix)
// ezyVet separation name is kept and shown in brackets after e.g. "(Department A)"
export const BRANCH_MAP = {
  1: {
    realName: "Dubai Investment Park (DIP)",
    photo:    "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:  "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:    "8am – 9pm daily",
  },
  4: {
    realName: "Jumeirah",
    photo:    "https://framerusercontent.com/images/lqrR41VkWauKj02z17JplcKOs.webp?width=800",
    address:  "Villa 63 Umm Al Sheif St, Jumeirah 3, Dubai",
    hours:    "Mon–Fri 8am–8pm · Sat–Sun 9am–6pm",
  },
  5: {
    realName: "Jumeirah Lake Towers (JLT)",
    photo:    "https://framerusercontent.com/images/hPLBXv621QKLaSk5kWzR88tvB9k.webp?width=800",
    address:  "Retail R3A, Lake Point Tower, Cluster N, JLT",
    hours:    "10am – 7pm daily",
  },
  9: {
    realName: "Sports City",
    photo:    "https://framerusercontent.com/images/TV5pz7Ult5uD58sxDq18jVWDDI.webp?width=800",
    address:  "Shop 1, Canal Residence West, Dubai Sports City",
    hours:    "Call for hours",
  },
  11: {
    realName: "Sustainable City",
    photo:    "https://framerusercontent.com/images/Om0XtUe6bUMiRMKb0bfUkXGPjCo.webp?width=800",
    address:  "Sustainable City Plaza, Off Al Qudra Rd, Dubailand",
    hours:    "Call for hours",
  },
  13: {
    realName: "Dubai Investment Park (DIP)",
    photo:    "https://framerusercontent.com/images/q3jxUlzjD51IaA8fkPDpE8TdGI.webp?width=800",
    address:  "Retail #5, Al Merdas Building, Green Community, DIP 1",
    hours:    "8am – 9pm daily",
  },
  // Add production separation IDs here when going live
};

export const FALLBACK_BRANCH = {
  realName: null,
  photo:    null, // replaced by Vercel Blob "locations/default.jpg" at runtime — see getBlobOverrides
  address:  "Dubai, UAE",
  hours:    "Call +971 600 566 253",
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
