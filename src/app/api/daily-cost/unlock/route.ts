import { NextResponse, type NextRequest } from "next/server";
import {
  getDailyTransactionById,
  unlockDailyTransaction,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-cost/unlock
 * Body: { id, reopenTo? }  (reopenTo defaults to "submitted")
 *
 * Reopens a locked daily-cost entry so a site can correct it. Restricted to
 * personas that can configure/lock periods (Leader/Super Admin), and only within
 * their scope. Revalidates the KPI cache afterwards.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat membuka kunci periode." },
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
  const reopenTo = body.reopenTo === "draft" ? "draft" : "submitted";
  if (!id) return NextResponse.json({ error: "id transaksi wajib diisi." }, { status: 400 });

  try {
    const existing = await getDailyTransactionById(id);
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    const authz = authorizeDashboard(persona, {
      projectId: existing.projectId,
      locationId: existing.locationId,
      scope: "tenant",
    });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }

    const updated = await unlockDailyTransaction(id, reopenTo);
    if (!updated) {
      return NextResponse.json(
        { error: "Transaksi tidak dalam status terkunci." },
        { status: 409 },
      );
    }
    revalidateKpi();
    return NextResponse.json({ source: "db", transaction: updated });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Buka kunci dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      id,
      reopenTo,
    });
  }
}
