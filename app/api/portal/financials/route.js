// src/app/api/portal/financials/route.js
// GET — current balance, spending history and recent invoices for the
// logged-in contact.
//
// ── Status ─────────────────────────────────────────────────────────────────
// The `read-invoice` scope is now granted (see lib/ezyvet/auth.js), so this can
// finally talk to the real invoice resource instead of hoping. What is STILL
// unconfirmed is the response field naming — ezyVet documents both
// `GET /v1/invoice` and `GET /v2/invoice` but this project has no live sample.
//
// So: v2 first, fall back to v1, read every field through `pick()` with ordered
// candidates, normalise all timestamps to epoch seconds, and log the real shape
// of the first record on each deploy. After one live request the Vercel logs
// will show the actual key names and this can be tightened to them.
// (Same discipline as the animal `species_name` bug — never assume.)

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";
import { logRecordShape, unwrap, pick, pickNumber, toEpochSeconds } from "@/lib/ezyvet/shape";

const YEAR = 365 * 24 * 60 * 60;

/** Treats an invoice as settled if nothing is owing on it. */
function mapInvoice(raw) {
  const inv = unwrap(raw, "invoice");

  const total = pickNumber(inv, ["total", "total_incl_tax", "amount", "invoice_total", "grand_total"], 0);
  const paid  = pickNumber(inv, ["amount_paid", "paid", "total_paid", "payment_total"], 0);

  // Prefer an explicit balance field; only derive when the API doesn't give one,
  // since a derived balance silently hides partial-payment/credit-note logic.
  const explicitOwing = pick(inv, ["amount_owing", "balance", "amount_due", "outstanding"], null);
  const owing = explicitOwing !== null
    ? Number(explicitOwing) || 0
    : Math.max(0, total - paid);

  return {
    id:           pick(inv, ["id"]),
    number:       pick(inv, ["number", "invoice_number", "reference", "code"]),
    date:         toEpochSeconds(pick(inv, ["invoice_date", "created_at", "date", "issued_at"])),
    due_date:     toEpochSeconds(pick(inv, ["due_date", "date_due", "payment_due_at"])),
    total,
    amount_paid:  paid,
    amount_owing: owing,
    status:       pick(inv, ["status_name", "status", "state"]),
    description:  pick(inv, ["description", "reference", "comments", "notes"]),
    animal_id:    pick(inv, ["animal_id"]),
  };
}

export async function GET(req) {
  const corsHeaders = getCredentialedCorsHeaders(req);
  try {
    const session = getSession(req);
    if (!session) {
      const r = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    }

    const token   = await getAccessToken();
    const base    = process.env.EZYVET_BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    console.log("═══════════════════════════════════════");
    console.log("[/api/portal/financials] contact_id:", session.contactId);

    let rows = [];
    let usedEndpoint = null;
    let scopeOk = true;

    // ── v2 first, then v1 ───────────────────────────────────────────────────
    for (const version of ["v2", "v1"]) {
      const url = `${base}/${version}/invoice?contact_id=${session.contactId}&limit=200`;
      const res  = await fetch(url, { headers });
      const text = await res.text();
      console.log(`[/api/portal/financials] ${version}/invoice status:`, res.status);

      if (res.ok) {
        try {
          rows = JSON.parse(text).items ?? [];
          usedEndpoint = version;
          break;
        } catch {
          console.log(`[/api/portal/financials] ${version}/invoice returned non-JSON:`, text.slice(0, 300));
        }
      } else {
        // 401/403 on BOTH versions means the scope isn't actually granted on
        // this site config, even though the token issued fine.
        if (res.status === 401 || res.status === 403) scopeOk = false;
        console.log(`[/api/portal/financials] ${version}/invoice failed:`, text.slice(0, 300));
      }
    }

    if (rows.length) logRecordShape("/api/portal/financials", unwrap(rows[0], "invoice"));
    console.log("[/api/portal/financials] endpoint used:", usedEndpoint, "| invoice count:", rows.length, "| scope_ok:", scopeOk);

    const invoices = rows.map(mapInvoice).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

    const currentBalance     = invoices.reduce((sum, i) => sum + (i.amount_owing || 0), 0);
    const totalPaidLifetime  = invoices.reduce((sum, i) => sum + (i.amount_paid  || 0), 0);

    // Outstanding invoices, oldest first — this is the list a client most needs
    // to act on, so surfacing the longest-overdue at the top is the useful order.
    const pendingPayments = invoices
      .filter((i) => i.amount_owing > 0)
      .sort((a, b) => (a.due_date ?? a.date ?? 0) - (b.due_date ?? b.date ?? 0));

    const oneYearAgo = Math.floor(Date.now() / 1000) - YEAR;
    const previousSpending = invoices
      .filter((i) => i.date && i.date >= oneYearAgo)
      .reduce((sum, i) => sum + (i.amount_paid || 0), 0);

    console.log(
      "[/api/portal/financials] ✓ balance:", currentBalance,
      "| pending:", pendingPayments.length,
      "| lifetime paid:", totalPaidLifetime,
      "| last 12mo:", previousSpending
    );
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({
      current_balance:        currentBalance,
      total_paid_lifetime:    totalPaidLifetime,
      previous_spending_12mo: previousSpending,
      pending_payments:       pendingPayments,
      invoices:               invoices.slice(0, 25),
      // Debug surface — lets the frontend distinguish "no invoices" from
      // "couldn't read invoices". Drop once the shape is confirmed.
      endpoint_used: usedEndpoint,
      scope_ok:      scopeOk,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;

  } catch (err) {
    console.error("[/api/portal/financials] error:", err);
    const r = NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCredentialedCorsHeaders(req) });
}
