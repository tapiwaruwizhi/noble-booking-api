// src/app/api/portal/financials/route.js
// GET — returns current balance, historical spending, and recent invoices
// for the logged-in contact.
//
// NOTE: exact field names for ezyVet's invoice endpoint aren't confirmed
// against your sandbox yet. This tries /v2/invoice first, falls back to
// /v1/invoice, and logs the raw response either way so field names can be
// adjusted the same way we iterated on contact/appointment/animal earlier.

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ezyvet/auth";
import { getSession } from "@/lib/requireAuth";
import { getCredentialedCorsHeaders } from "@/lib/cors";

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

    let invoices = [];
    let usedEndpoint = null;

    // ── Try v2/invoice first ────────────────────────────────────────────────
    const v2Url = `${base}/v2/invoice?contact_id=${session.contactId}&limit=100`;
    const v2Res  = await fetch(v2Url, { headers });
    const v2Text = await v2Res.text();
    console.log("[/api/portal/financials] v2/invoice status:", v2Res.status);

    if (v2Res.ok) {
      const v2Data = JSON.parse(v2Text);
      invoices = v2Data.items ?? [];
      usedEndpoint = "v2";
    } else {
      console.log("[/api/portal/financials] v2/invoice failed:", v2Text, "— trying v1");
      const v1Url = `${base}/v1/invoice?contact_id=${session.contactId}&limit=100`;
      const v1Res  = await fetch(v1Url, { headers });
      const v1Text = await v1Res.text();
      console.log("[/api/portal/financials] v1/invoice status:", v1Res.status, v1Text.slice(0, 500));
      if (v1Res.ok) {
        const v1Data = JSON.parse(v1Text);
        invoices = v1Data.items ?? [];
        usedEndpoint = "v1";
      }
    }

    console.log("[/api/portal/financials] endpoint used:", usedEndpoint, "| invoice count:", invoices.length);

    const mapped = invoices.map(i => {
      const inv = i.invoice ?? i;
      return {
        id:            inv.id,
        date:          inv.invoice_date ?? inv.created_at ?? null,
        due_date:      inv.due_date ?? null,
        total:         Number(inv.total ?? inv.amount ?? 0),
        amount_paid:   Number(inv.amount_paid ?? inv.paid ?? 0),
        amount_owing:  Number(inv.amount_owing ?? inv.balance ?? Math.max(0, Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0))),
        status:        inv.status_name ?? inv.status ?? null,
        description:   inv.description ?? inv.reference ?? null,
      };
    }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

    const currentBalance   = mapped.reduce((sum, inv) => sum + (inv.amount_owing || 0), 0);
    const totalPaidLifetime = mapped.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    // Pending payments — any invoice with an outstanding balance, oldest first
    // (typically what a client most needs to see and act on)
    const pendingPayments = mapped
      .filter(inv => inv.amount_owing > 0)
      .sort((a, b) => (a.due_date ?? a.date ?? 0) - (b.due_date ?? b.date ?? 0));

    // "Previous spending" — total paid in the last 12 months, as a
    // reasonably useful default breakdown; adjust once real data confirms field names
    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const previousSpending = mapped
      .filter(inv => inv.date && inv.date >= oneYearAgo)
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    console.log("[/api/portal/financials] ✓ balance:", currentBalance, "| pending count:", pendingPayments.length, "| lifetime paid:", totalPaidLifetime, "| last 12mo:", previousSpending);
    console.log("═══════════════════════════════════════");

    const r = NextResponse.json({
      current_balance:    currentBalance,
      total_paid_lifetime: totalPaidLifetime,
      previous_spending_12mo: previousSpending,
      pending_payments: pendingPayments,
      invoices: mapped.slice(0, 25), // recent transactions for the table
      endpoint_used: usedEndpoint,   // surfaced for debugging — remove once confirmed stable
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