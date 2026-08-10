import { NextResponse, type NextRequest } from "next/server";
import { listLockPeriods } from "@/db/repositories/lock-period-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks } from "@/lib/mock/lock-period";

export const dynamic = "force-dynamic";

/**
 * GET /api/unlock-period?projectId=&locationId=
 *
 * Lists currently locked periods for the Unlock Period page. Restricted to
 * Leader/Super Admin — a Site Admin cannot browse the portfolio of locked
 * periods to unlock. Falls back to the config-derived mock lock schedule
 * (locked periods only) when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const isLeader = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Daftar periode terkunci hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  try {
    const rows = (
      await listLockPeriods({ projectId, locationId, locked: true, scope: "executive" })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, periods: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const periods = buildPeriodLocks(sites).filter((p) => p.state === "locked");
    return NextResponse.json({ source: "mock", count: periods.length, periods });
  }
}
