import { NextResponse, type NextRequest } from "next/server";
import { listInvoiceRollup, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/by-site?projectId=&locationId=&scope=
 * Per-site invoice rollup (count + amount by status and aging bucket) for the
 * invoice-monitoring dashboard, scoped to the persona. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Falls back to mock aggregation
 * when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: InvoiceFilter = { projectId, locationId, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listInvoiceRollup(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const map = new Map<string, { projectId: string; locationId: string; status: string; agingBucket: string; count: number; amount: number }>();
    for (const s of sites) {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) continue;
      for (const inv of detail.invoices) {
        const key = `${s.locationId}|${inv.status}|${inv.agingBucket}`;
        const entry = map.get(key) ?? {
          projectId: s.projectCode,
          locationId: s.locationId,
          status: inv.status,
          agingBucket: inv.agingBucket,
          count: 0,
          amount: 0,
        };
        entry.count += 1;
        entry.amount += inv.amount;
        map.set(key, entry);
      }
    }
    const rows = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    return NextResponse.json({ source: "mock", filter, count: rows.length, rows });
  }
}
