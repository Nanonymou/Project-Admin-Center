import { NextResponse, type NextRequest } from "next/server";
import { listDailyClosings, type ClosingFilter } from "@/db/repositories/daily-closing-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/** Deterministic status for a synthesized closing from its date seed. */
function mockStatus(seed: string): "open" | "submitted" | "approved" | "locked" {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const states = ["open", "submitted", "approved", "locked"] as const;
  return states[Math.abs(h) % states.length];
}

/**
 * GET /api/daily-closing?projectId=&locationId=&status=&period=&from=&to=&scope=
 * Lists daily-closing statuses across the sites the persona may see, newest date
 * first. Cross-site (executive) access is restricted to Leader/Super Admin.
 * Falls back to synthesized closings from mock daily data when the DB is down.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const status = sp.get("status") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ClosingFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    status,
    from: period.from,
    to: period.to,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listDailyClosings(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, closings: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    let closings = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [];
      return detail.daily30d
        .filter((d) => (!filter.from || d.iso >= filter.from) && (!filter.to || d.iso <= filter.to))
        .map((d) => ({
          id: `${s.locationId}-${d.iso}`,
          projectCode: s.projectCode,
          locationId: s.locationId,
          closingDate: d.iso,
          status: mockStatus(`${s.locationId}-${d.iso}`),
        }));
    });
    if (status) closings = closings.filter((c) => c.status === status);
    closings.sort((a, b) => (a.closingDate < b.closingDate ? 1 : -1));
    return NextResponse.json({ source: "mock", filter, count: closings.length, closings });
  }
}
