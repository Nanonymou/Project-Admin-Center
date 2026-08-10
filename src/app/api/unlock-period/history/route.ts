import { NextResponse, type NextRequest } from "next/server";
import { listLockHistory } from "@/db/repositories/lock-period-repository";
import { listUnlockRequests } from "@/db/repositories/unlock-request-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/unlock-period/history?projectId=&locationId=&periodLabel=
 *
 * Returns the unlock activity history for the Unlock Period page: the "unlock"
 * entries from the period-lock history plus the recorded unlock decisions
 * (requests), scoped to the persona. Restricted to Leader/Super Admin. Falls
 * back to an empty history when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const isLeader = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Riwayat buka kunci hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const periodLabel = sp.get("periodLabel") ?? undefined;

  try {
    const [historyRows, requestRows] = await Promise.all([
      listLockHistory({ projectId, locationId, periodLabel, limit: 200 }),
      listUnlockRequests({ projectId, locationId, periodLabel, limit: 200 }),
    ]);

    const history = historyRows
      .filter((r) => r.action === "unlock" && canAccessLocation(persona, r.locationId, r.projectId))
      .map((r) => ({
        projectId: r.projectId,
        locationId: r.locationId,
        periodLabel: r.periodLabel,
        actor: r.actor,
        reason: r.reason,
        at: r.createdAt.toISOString(),
      }));

    const requests = requestRows
      .filter((r) => canAccessLocation(persona, r.locationId, r.projectId))
      .map((r) => ({
        projectId: r.projectId,
        locationId: r.locationId,
        periodLabel: r.periodLabel,
        status: r.status,
        requestedBy: r.requestedBy,
        reason: r.reason,
        reviewedBy: r.reviewedBy,
        at: r.createdAt.toISOString(),
      }));

    return NextResponse.json({ source: "db", history, requests });
  } catch {
    return NextResponse.json({ source: "mock", history: [], requests: [] });
  }
}
