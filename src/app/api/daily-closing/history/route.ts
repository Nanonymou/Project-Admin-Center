import { NextResponse, type NextRequest } from "next/server";
import { listClosingHistory, type ClosingHistoryFilter } from "@/db/repositories/daily-closing-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-closing/history?closingId=&projectId=&locationId=&limit=&scope=
 * Daily-closing status-change history (submit / approve / reject / lock /
 * reopen), newest first — for one closing or a site. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Returns an empty list when the DB
 * is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const closingId = sp.get("closingId") ?? undefined;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ClosingHistoryFilter = { closingId, projectId, locationId, limit, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!closingId) {
    const authz = authorizeDashboard(persona, { projectId, locationId, scope });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }
  }

  try {
    const rows = (await listClosingHistory(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", closingId, count: rows.length, history: rows });
  } catch {
    return NextResponse.json({ source: "mock", closingId, count: 0, history: [] });
  }
}
