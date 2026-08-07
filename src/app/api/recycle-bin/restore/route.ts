import { NextResponse, type NextRequest } from "next/server";
import {
  getDeletedTransactionById,
  restoreDailyTransaction,
} from "@/db/repositories/daily-transaction-repository";
import { getDeletedInvoiceById, restoreInvoice } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * POST /api/recycle-bin/restore
 * Body: { type: "invoice" | "daily_sales" | "daily_cost" | "transaction", id }
 *
 * Restores a soft-deleted record, verifying the persona may access its site.
 * Viewers cannot restore. Revalidates the KPI cache afterwards.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat memulihkan data." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const type = typeof body.type === "string" ? body.type : "";
  const isInvoice = type === "invoice";
  const isTransaction = type === "daily_sales" || type === "daily_cost" || type === "transaction";
  if (!id || (!isInvoice && !isTransaction)) {
    return NextResponse.json(
      { error: "id dan type (invoice|daily_sales|daily_cost) wajib diisi." },
      { status: 400 },
    );
  }

  try {
    // Fetch the recycled record to authorize against its site.
    const record = isInvoice ? await getDeletedInvoiceById(id) : await getDeletedTransactionById(id);
    if (!record) {
      return NextResponse.json({ error: "Data terhapus tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessLocation(persona, record.locationId, record.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke data ini." }, { status: 403 });
    }
    const authz = authorizeDashboard(persona, {
      projectId: record.projectId,
      locationId: record.locationId,
      scope: "tenant",
    });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }

    const restored = isInvoice ? await restoreInvoice(id) : await restoreDailyTransaction(id);
    revalidateKpi();
    return NextResponse.json({ source: "db", type, id, restored });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Pemulihan dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      type,
      id,
    });
  }
}
