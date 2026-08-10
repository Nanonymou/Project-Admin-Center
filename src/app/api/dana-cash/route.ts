import { NextResponse, type NextRequest } from "next/server";
import {
  listDanaCashTransactions,
  createDanaCashTransaction,
  type DanaCashFilter,
} from "@/db/repositories/dana-cash-repository";
import type { NewDanaCashTransaction } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { danaCashOpeningBalance } from "@/lib/mock/dana-cash";

export const dynamic = "force-dynamic";

/**
 * GET /api/dana-cash?projectId=&locationId=
 * Lists Dana Cash transactions with a derived running balance (opening balance +
 * signed movements), scoped to the persona. Falls back to an empty ledger when
 * the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DanaCashFilter = { projectId, locationId, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (await listDanaCashTransactions(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    // Derive a running balance per location (opening balance + signed movements).
    const balances = new Map<string, number>();
    const ledger = rows.map((r) => {
      const opening = balances.get(r.locationId) ?? danaCashOpeningBalance(r.locationId);
      const signed = r.direction === "top_up" ? Number(r.amount) : -Number(r.amount);
      const balance = opening + signed;
      balances.set(r.locationId, balance);
      return { ...r, signedAmount: signed, balance };
    });
    return NextResponse.json({ source: "db", count: ledger.length, transactions: ledger });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, transactions: [] });
  }
}

/**
 * POST /api/dana-cash
 * Body: { projectId, locationId, trxDate, direction, categoryKey?, description?, amount }
 * Creates a Dana Cash transaction (top-up or expense); the amount is stored
 * positive with the direction giving the sign. Restricted to input-capable
 * personas with site access.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mencatat transaksi kas." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const trxDate = typeof body.trxDate === "string" ? body.trxDate : "";
  const direction = body.direction === "top_up" ? "top_up" : body.direction === "expense" ? "expense" : "";
  const amount = Number(body.amount);

  if (!projectId || !locationId || !/^\d{4}-\d{2}-\d{2}$/.test(trxDate) || !direction) {
    return NextResponse.json(
      { error: "projectId, locationId, trxDate (YYYY-MM-DD), dan direction (top_up|expense) wajib diisi." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount harus angka > 0." }, { status: 422 });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const values: NewDanaCashTransaction = {
    projectId,
    locationId,
    trxDate,
    direction,
    categoryKey: typeof body.categoryKey === "string" ? body.categoryKey : null,
    description: typeof body.description === "string" ? body.description : null,
    amount: amount.toFixed(2),
    performedBy: persona.name,
    createdBy: persona.name,
  };

  try {
    const row = await createDanaCashTransaction(values, persona.name);
    return NextResponse.json({ source: "db", transaction: row }, { status: 201 });
  } catch {
    return NextResponse.json(
      { source: "mock", transaction: { ...values, id: `mock-${Date.now()}` } },
      { status: 201 },
    );
  }
}
