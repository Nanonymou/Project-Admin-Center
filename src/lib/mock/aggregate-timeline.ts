import { buildSiteApprovalTimelines, type InvoiceTimeline } from "./approval-timeline";
import type { SiteDetail } from "./site-detail";
import type { SiteKpi } from "./site-kpi";

export type AggregateTimelineRow = InvoiceTimeline & {
  projectCode: string;
  locationId: string;
  locationName: string;
};

/**
 * Flatten per-site approval timelines into a single list annotated with the
 * originating site, for a portfolio-wide Gantt view.
 */
export function buildAggregateTimelines(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): AggregateTimelineRow[] {
  const rows: AggregateTimelineRow[] = [];
  for (const site of sites) {
    const detail = detailMap[site.locationId];
    if (!detail) continue;
    for (const t of buildSiteApprovalTimelines(detail)) {
      rows.push({
        ...t,
        projectCode: site.projectCode,
        locationId: site.locationId,
        locationName: site.locationName,
      });
    }
  }
  return rows.sort((a, b) => b.totalElapsedDays - a.totalElapsedDays);
}
