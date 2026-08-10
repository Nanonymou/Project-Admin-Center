import { NextResponse, type NextRequest } from "next/server";
import {
  applyLockToTransactions,
  listLockPeriods,
  recordLockHistory,
  setPeriodLock,
} from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks } from "@/lib/mock/lock-period";

export const dynamic = "force-dynamic";

/**
 * GET /api/lock-period?projectId=&locationId=&locked=&scope=
 *
 * Returns the lock status per site/period, scoped to the persona. Falls back to
 * the config-derived mock lock schedule when the database is unavailable so the
 * Kunci Periode page always has data.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const lockedRaw = sp.get("locked");
  const locked = lockedRaw === "true" ? true : lockedRaw === "false" ? false : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listLockPeriods({ projectId, locationId, locked, scope })).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, periods: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    let periods = buildPeriodLocks(sites);
    if (locked !== undefined) periods = periods.filter((p) => (p.state === "locked") === locked);
    return NextResponse.json({ source: "mock", count: periods.length, periods });
  }
}

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
    // Append the lock/unlock action to the period-lock history.
    try {
      await recordLockHistory({
        projectId,
        locationId,
        periodLabel,
        action: locked ? "lock" : "unlock",
        actor: persona.name,
        reason,
      });
    } catch {
      // history is best-effort
    }
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
