import { NextResponse, type NextRequest } from "next/server";
import {
  createDailySubmission,
  type DailySubmissionLine,
} from "@/db/repositories/daily-transaction-repository";
import { listMasterPrices } from "@/db/repositories/master-price-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { validatePeriodInput } from "@/lib/server/guards/period-input-guard";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";
import { getPriceFor } from "@/lib/mock/pricing-config";
import { getTaxConfig } from "@/lib/mock/tax-config";

export const dynamic = "force-dynamic";

type LineInput = { categoryKey: string; qty: number };

/**
 * POST /api/perhitungan/transaction
 * Body: { projectId, locationId, trxDate, kind?, lines: [{ categoryKey, qty }] }
 *
 * Saves a transaction with amounts computed on the server. For each line the
 * price is resolved from the per-location master price list (falling back to the
 * config pricing engine), the amount is `qty × price` (negated for deduction
 * categories), and the subtotal / tax (PPN or PB1 by project) / total are
 * derived so the client can never dictate the numbers. Persists via the daily
 * submission repository; returns the computed breakdown even when the DB is
 * unavailable.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const trxDate = typeof body.trxDate === "string" ? body.trxDate : "";
  const kind = body.kind === "cost" ? "cost" : "sales";
  const rawLines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];

  if (!projectId || !locationId || !/^\d{4}-\d{2}-\d{2}$/.test(trxDate) || rawLines.length === 0) {
    return NextResponse.json(
      { error: "projectId, locationId, trxDate (YYYY-MM-DD), dan lines wajib diisi." },
      { status: 400 },
    );
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Cut-off / H+1 guard: cannot write into a closed period.
  const policy = validatePeriodInput(projectId, trxDate);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error }, { status: policy.status });
  }
  // Locked-period guard: reject a save when the target period is locked.
  try {
    if (await isPeriodLocked(projectId, locationId, trxDate)) {
      return NextResponse.json({ error: "Periode terkunci — data tidak dapat diubah." }, { status: 409 });
    }
  } catch {
    // If the lock table is unavailable, fall through (mock mode).
  }

  const lineInputs: LineInput[] = [];
  for (const l of rawLines) {
    const categoryKey = typeof l.categoryKey === "string" ? l.categoryKey : "";
    const qty = Number(l.qty);
    if (!categoryKey || !Number.isFinite(qty) || qty < 0) {
      return NextResponse.json(
        { error: "Setiap line butuh categoryKey dan qty >= 0." },
        { status: 422 },
      );
    }
    lineInputs.push({ categoryKey, qty });
  }

  // Category metadata (label, unit, deduction) from config for the given kind.
  const catalog = kind === "cost" ? getCostCategories(projectId) : getServiceCategories(projectId);
  const catBy = new Map(catalog.map((c) => [c.key, c]));

  // Try DB master prices first; fall back to the config pricing engine per line.
  let dbPrices: Map<string, number> | null = null;
  try {
    const rows = await listMasterPrices({ projectCode: projectId, locationId, activeOnly: true });
    if (rows.length > 0) dbPrices = new Map(rows.map((r) => [r.categoryKey, Number(r.price)]));
  } catch {
    dbPrices = null;
  }

  const computedLines = lineInputs.map((li) => {
    const cat = catBy.get(li.categoryKey);
    const isDeduction = Boolean((cat as { deduction?: boolean } | undefined)?.deduction);
    const price =
      dbPrices?.get(li.categoryKey) ??
      (kind === "sales"
        ? getPriceFor(projectId, locationId, li.categoryKey)
        : (cat as { defaultPrice?: number } | undefined)?.defaultPrice ?? 0);
    const amount = li.qty * price * (isDeduction ? -1 : 1);
    return {
      categoryKey: li.categoryKey,
      label: cat?.label ?? li.categoryKey,
      qty: li.qty,
      unitPrice: price,
      amount,
      isDeduction,
    };
  });

  const subtotal = computedLines.reduce((s, l) => s + l.amount, 0);
  const tax = getTaxConfig(projectId);
  const taxAmount = Math.round(subtotal * tax.rate);
  const total = subtotal + taxAmount;

  const breakdown = {
    projectId,
    locationId,
    trxDate,
    kind,
    lines: computedLines,
    subtotal,
    taxLabel: tax.label,
    taxAmount,
    total,
  };

  const repoLines: DailySubmissionLine[] = computedLines.map((l) => ({
    categoryKey: l.categoryKey,
    label: l.label,
    qty: String(l.qty),
    unitPrice: l.unitPrice.toFixed(2),
    amount: l.amount.toFixed(2),
    isDeduction: l.isDeduction,
  }));

  try {
    const header = await createDailySubmission({
      projectId,
      locationId,
      kind,
      trxDate,
      subtotal: subtotal.toFixed(2),
      tax: taxAmount.toFixed(2),
      total: total.toFixed(2),
      isLate: false,
      submittedBy: persona.name,
      lines: repoLines,
    });
    return NextResponse.json({ source: "db", id: header.id, ...breakdown });
  } catch {
    return NextResponse.json({ source: "mock", ...breakdown });
  }
}
