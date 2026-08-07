import { NextResponse, type NextRequest } from "next/server";
import { createDailySubmission } from "@/db/repositories/daily-transaction-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";
import { parseCsv } from "@/lib/csv";
import { prepareDailySalesSubmission } from "@/lib/server/services/daily-sales-submission-service";
import type { SalesEntryInput } from "@/lib/mock/service-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-sales/import
 * Body: { projectId, locationId, csv }
 *
 * Imports daily-sales entries from Excel-compatible CSV. Expected columns
 * (header row required): trxDate, categoryKey, qty, price. Rows are grouped by
 * trxDate into one submission each, validated with the dynamic per-project
 * rules, and created (skipping any date whose period is locked). Returns a
 * per-date result summary. Viewers cannot import.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengimpor data." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!projectId || !locationId || !csv) {
    return NextResponse.json({ error: "projectId, locationId, dan csv wajib diisi." }, { status: 400 });
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Parse CSV and resolve column indices from the header row.
  const rows = parseCsv(csv).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    trxDate: header.indexOf("trxdate"),
    categoryKey: header.indexOf("categorykey"),
    qty: header.indexOf("qty"),
    price: header.indexOf("price"),
  };
  if (idx.trxDate < 0 || idx.categoryKey < 0 || idx.qty < 0) {
    return NextResponse.json(
      { error: "Header wajib memuat kolom: trxDate, categoryKey, qty (price opsional)." },
      { status: 422 },
    );
  }

  // Group rows into per-date value maps.
  const byDate = new Map<string, SalesEntryInput>();
  for (const r of rows.slice(1)) {
    const trxDate = (r[idx.trxDate] ?? "").trim();
    const categoryKey = (r[idx.categoryKey] ?? "").trim();
    if (!trxDate || !categoryKey) continue;
    const qty = Number(r[idx.qty]);
    const price = idx.price >= 0 ? Number(r[idx.price]) : 0;
    const entry = byDate.get(trxDate) ?? {};
    entry[categoryKey] = { qty: Number.isFinite(qty) ? qty : 0, price: Number.isFinite(price) ? price : 0 };
    byDate.set(trxDate, entry);
  }

  const results: { trxDate: string; ok: boolean; error?: string }[] = [];
  let created = 0;

  for (const [trxDate, values] of byDate) {
    const prepared = prepareDailySalesSubmission({
      projectId,
      locationId,
      trxDate,
      values,
      submittedBy: persona.name,
    });
    if (!prepared.ok) {
      results.push({ trxDate, ok: false, error: prepared.errors.map((e) => e.message).join("; ") });
      continue;
    }
    try {
      if (await isPeriodLocked(projectId, locationId, trxDate)) {
        results.push({ trxDate, ok: false, error: "Periode terkunci." });
        continue;
      }
      await createDailySubmission(prepared.input);
      created += 1;
      results.push({ trxDate, ok: true });
    } catch (err) {
      results.push({ trxDate, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (created > 0) revalidateKpi();
  return NextResponse.json({ imported: created, total: byDate.size, results });
}
