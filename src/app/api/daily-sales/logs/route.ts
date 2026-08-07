import { NextResponse, type NextRequest } from "next/server";
import { listDailyTransactionLogs, type LogFilter } from "@/db/repositories/daily-transaction-log-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seedNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/**
 * Synthesize a plausible change history for a transaction when there is no live
 * database, so the frontend can render the timeline. Deterministic per id.
 */
function mockLogs(transactionId: string) {
  const base = seedNum(transactionId);
  const steps = [
    { action: "create", detail: "Entri daily sales dibuat.", toStatus: "draft" },
    { action: "edit", detail: "Qty & harga disesuaikan.", toStatus: "draft" },
    { action: "submit", detail: "Disubmit untuk approval.", toStatus: "submitted" },
    { action: "approve", detail: "Disetujui.", toStatus: "approved" },
  ];
  const now = Date.now();
  return steps.map((s, i) => ({
    id: `${transactionId}-log-${i}`,
    transactionId,
    action: s.action,
    actor: i === 3 ? "Leader Admin" : "Site Admin",
    fromStatus: i === 0 ? null : steps[i - 1].toStatus,
    toStatus: s.toStatus,
    detail: s.detail,
    createdAt: new Date(now - (steps.length - i) * (6 + (base % 12)) * 3_600_000).toISOString(),
  }));
}

/**
 * GET /api/daily-sales/logs?transactionId=&projectId=&locationId=&limit=&scope=
 * Change history for the frontend — either one transaction's full history
 * (via transactionId) or a site's recent changes. Cross-site (executive) access
 * is restricted to Leader/Super Admin. Falls back to a synthesized history when
 * the database is unavailable and a transactionId is provided.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const transactionId = sp.get("transactionId") ?? undefined;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: LogFilter = { transactionId, projectId, locationId, limit, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  // Scope check applies to site-wide queries; a transactionId query is scoped by
  // the row's own tenancy, verified after fetch.
  if (!transactionId) {
    const authz = authorizeDashboard(persona, { projectId, locationId, scope });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }
  }

  try {
    const rows = (await listDailyTransactionLogs(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", transactionId, count: rows.length, logs: rows });
  } catch {
    if (!transactionId) {
      return NextResponse.json({ source: "mock", count: 0, logs: [] });
    }
    const logs = mockLogs(transactionId);
    return NextResponse.json({ source: "mock", transactionId, count: logs.length, logs });
  }
}
