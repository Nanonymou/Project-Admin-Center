import { NextResponse, type NextRequest } from "next/server";
import { listDailySubmissionsBatch } from "@/db/repositories/daily-submission-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/submit-daily-cost/overview?projectId=&status=
 *
 * Leader-Admin submission overview: cross-site Daily Cost batch submissions
 * aggregated per project (submitted / reviewed / approved / rejected counts and
 * totals). Restricted to Leader/Super Admin — a Site Admin has no portfolio
 * view. Falls back to an empty overview when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const isLeader = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Daftar submit lintas site hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;

  try {
    const rows = (
      await listDailySubmissionsBatch({
        projectId,
        kind: "cost",
        scope: "executive",
        limit: 500,
      })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));

    // Per-project aggregation.
    const byProject = new Map<
      string,
      { projectCode: string; submitted: number; reviewed: number; approved: number; rejected: number; total: number; sites: Set<string> }
    >();
    for (const r of rows) {
      const agg = byProject.get(r.projectId) ?? {
        projectCode: r.projectId,
        submitted: 0,
        reviewed: 0,
        approved: 0,
        rejected: 0,
        total: 0,
        sites: new Set<string>(),
      };
      if (r.status === "submitted") agg.submitted += 1;
      else if (r.status === "reviewed") agg.reviewed += 1;
      else if (r.status === "approved") agg.approved += 1;
      else if (r.status === "rejected") agg.rejected += 1;
      agg.total += Number(r.totalAmount);
      agg.sites.add(r.locationId);
      byProject.set(r.projectId, agg);
    }

    const projects = Array.from(byProject.values())
      .map((p) => ({
        projectCode: p.projectCode,
        siteCount: p.sites.size,
        submitted: p.submitted,
        reviewed: p.reviewed,
        approved: p.approved,
        rejected: p.rejected,
        total: p.total,
      }))
      .sort((a, b) => a.projectCode.localeCompare(b.projectCode));

    return NextResponse.json({
      source: "db",
      count: rows.length,
      projects,
      submissions: rows,
    });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, projects: [], submissions: [] });
  }
}
