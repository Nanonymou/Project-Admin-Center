import { NextResponse, type NextRequest } from "next/server";
import { listInvoiceRollup, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { AGING_BUCKETS, type AgingBucket } from "@/lib/aging";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type LocationAging = {
  projectCode: string;
  locationId: string;
  locationName?: string;
  buckets: Record<AgingBucket, number>;
  total: number;
};

function emptyBucketMap(): Record<AgingBucket, number> {
  return AGING_BUCKETS.reduce((acc, b) => ({ ...acc, [b]: 0 }), {} as Record<AgingBucket, number>);
}

/**
 * GET /api/invoices/aging/by-location?projectId=&locationId=&scope=
 * Per-location aging breakdown (amount per bucket) for a stacked-bar chart,
 * scoped to the persona. Cross-site (executive) access is restricted to
 * Leader/Super Admin. Falls back to mock aging data when the DB is unavailable.
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

  const isBucket = (b: string): b is AgingBucket => (AGING_BUCKETS as string[]).includes(b);

  try {
    const rows = (await listInvoiceRollup(filter)).filter(
      (r) => r.status !== "settled" && canAccessLocation(persona, r.locationId, r.projectId),
    );
    const map = new Map<string, LocationAging>();
    for (const r of rows) {
      if (!isBucket(r.agingBucket)) continue;
      const entry =
        map.get(r.locationId) ??
        { projectCode: r.projectId, locationId: r.locationId, buckets: emptyBucketMap(), total: 0 };
      entry.buckets[r.agingBucket] += r.amount;
      entry.total += r.amount;
      map.set(r.locationId, entry);
    }
    return NextResponse.json({ source: "db", filter, locations: finalize(map) });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const map = new Map<string, LocationAging>();
    for (const s of sites) {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) continue;
      const entry: LocationAging = {
        projectCode: s.projectCode,
        locationId: s.locationId,
        locationName: s.locationName,
        buckets: emptyBucketMap(),
        total: 0,
      };
      for (const inv of detail.invoices) {
        if (inv.stage === "Payment" || !isBucket(inv.agingBucket)) continue;
        entry.buckets[inv.agingBucket] += inv.amount;
        entry.total += inv.amount;
      }
      map.set(s.locationId, entry);
    }
    return NextResponse.json({ source: "mock", filter, locations: finalize(map) });
  }
}

function finalize(map: Map<string, LocationAging>) {
  return Array.from(map.values())
    .map((l) => ({
      ...l,
      total: round2(l.total),
      buckets: AGING_BUCKETS.reduce(
        (acc, b) => ({ ...acc, [b]: round2(l.buckets[b]) }),
        {} as Record<AgingBucket, number>,
      ),
    }))
    .sort((a, b) => b.total - a.total);
}
