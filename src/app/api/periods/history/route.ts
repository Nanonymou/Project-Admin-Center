import { NextResponse, type NextRequest } from "next/server";
import { listPeriodHistory, type PeriodHistoryFilter } from "@/db/repositories/period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/periods/history?periodId=&projectId=&locationId=&limit=&scope=
 * Period lifecycle history (open / close / lock / unlock / set-cutoff), newest
 * first — for one period or a site. Cross-site (executive) access is restricted
 * to Leader/Super Admin. Returns an empty list when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const periodId = sp.get("periodId") ?? undefined;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: PeriodHistoryFilter = { periodId, projectId, locationId, limit, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  // Site-wide queries need scope authorization; a periodId query is scoped by the
  // rows' own tenancy, verified after fetch.
  if (!periodId) {
    const authz = authorizeDashboard(persona, { projectId, locationId, scope });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }
  }

  try {
    const rows = (await listPeriodHistory(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", periodId, count: rows.length, history: rows });
  } catch {
    return NextResponse.json({ source: "mock", periodId, count: 0, history: [] });
  }
}
