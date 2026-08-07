import { NextResponse, type NextRequest } from "next/server";
import {
  getDeletedTransactionById,
  purgeDailyTransaction,
} from "@/db/repositories/daily-transaction-repository";
import { getDeletedInvoiceById, purgeInvoice } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * POST /api/recycle-bin/purge
 * Body: { type, id, confirm: true }
 *
 * Permanently deletes a recycled record — irreversible, so it requires an
 * explicit confirmation flag and is restricted to configure-capable personas
 * (Leader/Super Admin) within their scope. Only already-recycled rows can be
 * purged.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat menghapus permanen." },
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
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Konfirmasi diperlukan: kirim { confirm: true } untuk hapus permanen." },
      { status: 428 },
    );
  }

  try {
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

    const purged = isInvoice ? await purgeInvoice(id) : await purgeDailyTransaction(id);
    return NextResponse.json({ source: "db", type, id, purged });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Hapus permanen dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      type,
      id,
    });
  }
}
