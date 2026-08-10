import { NextResponse, type NextRequest } from "next/server";
import {
  getDanaCashTransactionById,
  listDanaCashAudit,
} from "@/db/repositories/dana-cash-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/dana-cash/:id/history
 * Returns the change history (create / update / delete audit trail) for a Dana
 * Cash transaction, with the before/after signed amount for each change.
 * Enforces site access.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const trx = await getDanaCashTransactionById(id);
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, trx.locationId, trx.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    const rows = await listDanaCashAudit(id);
    return NextResponse.json({
      source: "db",
      count: rows.length,
      history: rows.map((r) => ({
        action: r.action,
        beforeAmount: r.beforeAmount !== null ? Number(r.beforeAmount) : null,
        afterAmount: r.afterAmount !== null ? Number(r.afterAmount) : null,
        actor: r.actor,
        detail: r.detail,
        at: r.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
