import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites, buildApprovalTrend } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/approval-trend?projectId=&locationId=
 *
 * The 6-week approval trend — approved vs pending counts plus average completion
 * duration (days) — for the Analytics Dashboard, seeded from the persona's scoped
 * pending-approval volume. Persona-scoped with optional project/location filter.
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
  const pending = sites.reduce((s, x) => s + x.pendingApprovals, 0);
  const trend = buildApprovalTrend(pending + sites.length * 4);

  const avgCompletion =
    trend.length > 0 ? trend.reduce((s, p) => s + p.avgDurationDays, 0) / trend.length : 0;

  return NextResponse.json({
    source: "config",
    siteCount: sites.length,
    avgCompletionDays: Math.round(avgCompletion * 10) / 10,
    trend,
  });
}
