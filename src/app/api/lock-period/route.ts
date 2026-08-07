import { NextResponse, type NextRequest } from "next/server";
import {
  applyLockToTransactions,
  setPeriodLock,
} from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * POST /api/lock-period
 * Body: { projectId, locationId, periodLabel, action: "lock"|"unlock",
 *         periodStart?, periodEnd?, reason? }
 *
 * Locks or unlocks an invoice period for a site and cascades the state to the
 * daily transactions within the period window. Restricted to personas that can
 * configure/lock periods (Leader/Super Admin), within their scope. Revalidates
 * the KPI cache afterwards.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat mengunci periode." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel : "";
  const action = body.action === "unlock" ? "unlock" : body.action === "lock" ? "lock" : "";
  const periodStart = typeof body.periodStart === "string" ? body.periodStart : undefined;
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : undefined;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!projectId || !locationId || !periodLabel || !action) {
    return NextResponse.json(
      { error: "projectId, locationId, periodLabel, dan action (lock|unlock) wajib diisi." },
      { status: 400 },
    );
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const locked = action === "lock";
  const input = {
    projectId,
    locationId,
    periodLabel,
    periodStart,
    periodEnd,
    locked,
    actor: persona.name,
    reason,
  };

  try {
    const lock = await setPeriodLock(input);
    const affected = await applyLockToTransactions({
      projectId,
      locationId,
      from: periodStart,
      to: periodEnd,
      locked,
    });
    revalidateKpi();
    return NextResponse.json({ source: "db", lock, affectedTransactions: affected });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: `Periode ${locked ? "dikunci" : "dibuka"} secara simulasi (database tidak tersedia).`,
      detail: err instanceof Error ? err.message : String(err),
      lock: { ...input, lockedAt: locked ? new Date().toISOString() : null },
    });
  }
}
