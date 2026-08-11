import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import {
  resolveScopedSites,
  buildOutstandingTrend,
  totalOutstandingOf,
} from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/outstanding-trend?projectId=&locationId=
 *
 * The 6-month outstanding-receivables trend for the Analytics Dashboard, seeded
 * from the persona's scoped aging balance (last month = current). Persona-scoped,
 * config-derived.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const sites = resolveScopedSites(persona, { projectId, locationId });
  const current = totalOutstandingOf(sites);
  const trend = buildOutstandingTrend(current);

  return NextResponse.json({ source: "config", siteCount: sites.length, currentOutstanding: current, trend });
}
