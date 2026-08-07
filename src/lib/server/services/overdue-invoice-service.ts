import { buildOutstandingInvoicesFor } from "@/lib/mock/outstanding";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import type { SiteDetail, MockInvoice } from "@/lib/mock/site-detail";

export type OverdueInvoiceSummary = {
  projectId: string;
  locationId: string;
  locationName: string;
  overdueCount: number;
  overdueAmount: number;
  worstBucket: MockInvoice["agingBucket"] | null;
};

const BUCKET_ORDER: MockInvoice["agingBucket"][] = ["0-30", "31-60", "61-90", ">90"];

/**
 * Overdue-invoice data per site — count and total amount of invoices that are
 * overdue or in the >90-day aging bucket, plus the worst aging bucket present.
 * Every site in the input is represented (zero counts included). Sorted by the
 * largest overdue amount first.
 */
export function buildOverdueInvoiceSummaries(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): OverdueInvoiceSummary[] {
  const map = new Map<string, OverdueInvoiceSummary & { worstIdx: number }>();
  for (const s of sites) {
    map.set(s.locationId, {
      projectId: s.projectCode,
      locationId: s.locationId,
      locationName: s.locationName,
      overdueCount: 0,
      overdueAmount: 0,
      worstBucket: null,
      worstIdx: -1,
    });
  }

  for (const inv of buildOutstandingInvoicesFor(sites, detailMap)) {
    if (inv.status !== "overdue" && inv.agingBucket !== ">90") continue;
    const entry = map.get(inv.locationId);
    if (!entry) continue;
    entry.overdueCount += 1;
    entry.overdueAmount += inv.amount;
    const idx = BUCKET_ORDER.indexOf(inv.agingBucket);
    if (idx > entry.worstIdx) {
      entry.worstIdx = idx;
      entry.worstBucket = inv.agingBucket;
    }
  }

  return Array.from(map.values())
    .map(({ worstIdx: _worstIdx, ...rest }) => rest)
    .sort((a, b) => b.overdueAmount - a.overdueAmount);
}
