import { NextResponse, type NextRequest } from "next/server";
import { listInvoiceRollup, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { AGING_BUCKETS, weightedAverageAge, type AgingBucket } from "@/lib/aging";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type BucketTotal = { bucket: AgingBucket; count: number; amount: number };

function emptyBuckets(): Record<AgingBucket, BucketTotal> {
  return AGING_BUCKETS.reduce(
    (acc, b) => ({ ...acc, [b]: { bucket: b, count: 0, amount: 0 } }),
    {} as Record<AgingBucket, BucketTotal>,
  );
}

/**
 * GET /api/invoices/aging?projectId=&locationId=&scope=
 * Receivables aging summary: invoice count and amount per aging bucket, the
 * total outstanding (unsettled) and a weighted average age — scoped to the
 * persona. Cross-site (executive) access is restricted to Leader/Super Admin.
 * Falls back to mock aging data when the database is unavailable.
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
    const buckets = emptyBuckets();
    for (const r of rows) {
      if (!isBucket(r.agingBucket)) continue;
      buckets[r.agingBucket].count += r.count;
      buckets[r.agingBucket].amount += r.amount;
    }
    return NextResponse.json({ source: "db", filter, ...foldBuckets(buckets) });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const buckets = emptyBuckets();
    for (const s of sites) {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) continue;
      for (const inv of detail.invoices) {
        if (inv.stage === "Payment") continue;
        if (!isBucket(inv.agingBucket)) continue;
        buckets[inv.agingBucket].count += 1;
        buckets[inv.agingBucket].amount += inv.amount;
      }
    }
    return NextResponse.json({ source: "mock", filter, ...foldBuckets(buckets) });
  }
}

function foldBuckets(buckets: Record<AgingBucket, BucketTotal>) {
  const list = AGING_BUCKETS.map((b) => ({
    bucket: b,
    count: buckets[b].count,
    amount: round2(buckets[b].amount),
  }));
  const totalAmount = round2(list.reduce((s, b) => s + b.amount, 0));
  const totalCount = list.reduce((s, b) => s + b.count, 0);
  const weightedAvgAge = weightedAverageAge(
    list.flatMap((b) => Array.from({ length: b.count }, () => ({ agingBucket: b.bucket, amount: b.count ? b.amount / b.count : 0 }))),
  );
  return { totalAmount, totalCount, weightedAvgAge: round2(weightedAvgAge), buckets: list };
}
