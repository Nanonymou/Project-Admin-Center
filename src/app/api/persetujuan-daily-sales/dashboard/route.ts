import { NextResponse, type NextRequest } from "next/server";
import { listDailySubmissionsBatch } from "@/db/repositories/daily-submission-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { buildDailySalesSubmissions } from "@/lib/mock/daily-sales-approval";

export const dynamic = "force-dynamic";

/**
 * GET /api/persetujuan-daily-sales/dashboard?projectId=&locationId=&scope=
 *
 * Approved-only reporting aggregation for Daily Sales: dashboards and reports
 * must count only submissions that have been APPROVED, so pending/rejected data
 * never inflates the numbers. Returns the approved total, per-site and
 * per-project breakdowns, plus the value still excluded (not yet approved).
 * Scoped to the persona; falls back to mock data when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  // A uniform shape whether rows come from the DB or the mock.
  type Row = { projectCode: string; locationId: string; total: number; status: string };

  let rows: Row[];
  let source: "db" | "mock";
  try {
    const db = (
      await listDailySubmissionsBatch({ projectId, locationId, kind: "sales", scope, limit: 500 })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    if (db.length === 0) throw new Error("empty");
    rows = db.map((r) => ({
      projectCode: r.projectId,
      locationId: r.locationId,
      total: Number(r.totalAmount),
      status: r.status,
    }));
    source = "db";
  } catch {
    let mock = buildDailySalesSubmissions().filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectCode),
    );
    if (projectId) mock = mock.filter((s) => s.projectCode === projectId);
    if (locationId) mock = mock.filter((s) => s.locationId === locationId);
    rows = mock.map((s) => ({
      projectCode: s.projectCode,
      locationId: s.locationId,
      total: s.total,
      status: s.status,
    }));
    source = "mock";
  }

  const approved = rows.filter((r) => r.status === "approved");
  const approvedTotal = approved.reduce((s, r) => s + r.total, 0);
  const excludedTotal = rows.filter((r) => r.status !== "approved").reduce((s, r) => s + r.total, 0);

  const bySite = new Map<string, { locationId: string; projectCode: string; total: number; count: number }>();
  const byProject = new Map<string, { projectCode: string; total: number; count: number }>();
  for (const r of approved) {
    const site = bySite.get(r.locationId) ?? { locationId: r.locationId, projectCode: r.projectCode, total: 0, count: 0 };
    site.total += r.total;
    site.count += 1;
    bySite.set(r.locationId, site);
    const proj = byProject.get(r.projectCode) ?? { projectCode: r.projectCode, total: 0, count: 0 };
    proj.total += r.total;
    proj.count += 1;
    byProject.set(r.projectCode, proj);
  }

  return NextResponse.json({
    source,
    filter: "approved-only",
    approvedTotal,
    approvedCount: approved.length,
    excludedTotal,
    bySite: Array.from(bySite.values()).sort((a, b) => b.total - a.total),
    byProject: Array.from(byProject.values()).sort((a, b) => a.projectCode.localeCompare(b.projectCode)),
  });
}
