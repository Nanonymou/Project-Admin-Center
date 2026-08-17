import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { listApprovals } from "@/db/repositories/approval-repository";
import { ensureApprovalRows } from "@/lib/server/services/approval-generator-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/queue — the persona's approval queue as persisted DB rows,
 * keyed by `subjectId` (the deterministic mock id). Lazily generates the rows on
 * first access so the client's queue maps to real DB ids and transitions persist.
 * Returns per item: subjectId, DB id (uuid), currentStage, status, assignedTo.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    await ensureApprovalRows(persona);
    const rows = (await listApprovals({ scope: "executive" })).filter((a) =>
      canAccessLocation(persona, a.locationId, a.projectId),
    );
    return NextResponse.json({
      source: "db",
      count: rows.length,
      items: rows.map((a) => ({
        subjectId: a.subjectId,
        id: a.id,
        currentStage: a.currentStage,
        status: a.status,
        assignedTo: a.assignedTo,
        projectId: a.projectId,
        locationId: a.locationId,
      })),
    });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, items: [] });
  }
}
