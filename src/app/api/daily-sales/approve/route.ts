import { NextResponse, type NextRequest } from "next/server";
import {
  getDailyTransactionById,
  setDailyTransactionApproval,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-sales/approve
 * Body: { id, action: "approve"|"reject" }
 *
 * Approves or rejects a submitted daily transaction, within the persona's scope.
 * Restricted to personas that can approve; a locked entry cannot be changed.
 * Revalidates the KPI cache afterwards.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canApprove) {
    return NextResponse.json({ error: "Persona ini tidak memiliki hak approval." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : "";
  if (!id || !action) {
    return NextResponse.json(
      { error: "id dan action (approve|reject) wajib diisi." },
      { status: 400 },
    );
  }

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

    const updated = await setDailyTransactionApproval(id, action === "approve", persona.name);
    if (!updated) {
      return NextResponse.json({ error: "Transaksi terkunci atau tidak ditemukan." }, { status: 409 });
    }
    revalidateKpi();
    return NextResponse.json({ source: "db", transaction: updated });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Approval dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      id,
      action,
    });
  }
}
