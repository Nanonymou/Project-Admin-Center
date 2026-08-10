import { NextResponse, type NextRequest } from "next/server";
import {
  listAggregateActivities,
  type ActivityFilter,
} from "@/db/repositories/invoice-activity-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/audit?projectId=&locationId=&action=&from=&to=&limit=&scope=
 * Aggregate invoice audit trail across invoices — the oversight feed for the
 * Audit Trail Invoice page. Restricted to Leader Admin / Super Admin (site admins
 * and viewers see only per-invoice trails via /api/invoices/:id/audit). Results
 * are further filtered to the sites the persona may access. Cross-project
 * (executive) scope is only honored for these two roles.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  // Leader-Admin-only endpoint (matches the page's canViewAudit gate).
  const canViewAudit = persona.role === "leader_admin" || persona.role === "super_admin";
  if (!canViewAudit) {
    return NextResponse.json(
      { error: "Audit trail lintas invoice hanya untuk Leader Admin / Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const action = sp.get("action") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ActivityFilter = { projectId, locationId, action, from, to, limit, scope };

  try {
    const rows = (await listAggregateActivities(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, activities: rows });
  } catch {
    return NextResponse.json({ source: "mock", filter, count: 0, activities: [] });
  }
}
