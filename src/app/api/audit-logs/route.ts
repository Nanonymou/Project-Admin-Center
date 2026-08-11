import { NextResponse, type NextRequest } from "next/server";
import { listAuditLogs, type AuditLogFilter } from "@/db/repositories/audit-log-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { canViewAuditLog } from "@/lib/mock/access-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit-logs?projectId=&locationId=&category=&from=&to=&limit=&scope=
 * Cross-cutting audit log (period lifecycle, cut-off policy, access events),
 * newest first, scoped to the persona. Cross-site (executive) access is
 * restricted to Leader/Super Admin. Returns an empty list when the database is
 * unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: AuditLogFilter = { projectId, locationId, category, from, to, limit, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  // The audit trail is a privileged view — Leader/Super Admin only.
  if (!canViewAuditLog(persona.role)) {
    return NextResponse.json({ error: "Audit Log hanya untuk Leader/Super Admin." }, { status: 403 });
  }
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listAuditLogs(filter)).filter(
      (r) => !r.projectId || canAccessLocation(persona, r.locationId ?? "", r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, logs: rows });
  } catch {
    return NextResponse.json({ source: "mock", filter, count: 0, logs: [] });
  }
}
