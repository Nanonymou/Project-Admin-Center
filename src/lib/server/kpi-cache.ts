import { revalidateTag, unstable_cache } from "next/cache";
import {
  aggregateByPeriod,
  aggregateSalesCostBySite,
  type DashboardFilter,
  type PeriodGranularity,
  type PeriodPoint,
  type SiteKpiAggregate,
} from "@/db/repositories/daily-transaction-repository";
import { aggregateOutstanding, type InvoiceFilter, type OutstandingAggregate } from "@/db/repositories/invoice-repository";

/**
 * Cache tag shared by every KPI-derived read. Any write that changes a daily
 * transaction, closing status, or invoice calls {@link revalidateKpi} so the
 * next KPI request recomputes instead of serving a stale cached value — the
 * "auto-refresh KPI saat data berubah" behaviour, done server-side via Next's
 * tag-based revalidation rather than client polling.
 */
export const KPI_CACHE_TAG = "kpi";

/** Fallback time-based revalidation (seconds) so caches never go stale forever. */
const KPI_TTL_SECONDS = 60;

/** Build a stable cache key from a filter — cache is keyed on data, not persona. */
function keyOf(prefix: string, filter: DashboardFilter | InvoiceFilter, extra = ""): string {
  const f = filter as DashboardFilter & InvoiceFilter;
  return [prefix, f.scope ?? "", f.projectId ?? "", f.locationId ?? "", f.from ?? "", f.to ?? "", extra]
    .join("|");
}

/**
 * Cached per-site sales/cost aggregation. The result depends only on the filter
 * (not the caller), so it is safe to share across personas; each route applies
 * persona scoping to the cached result afterwards.
 */
export function cachedSalesCostBySite(filter: DashboardFilter): Promise<SiteKpiAggregate[]> {
  return unstable_cache(() => aggregateSalesCostBySite(filter), [keyOf("kpi:sc", filter)], {
    tags: [KPI_CACHE_TAG],
    revalidate: KPI_TTL_SECONDS,
  })();
}

/** Cached outstanding-invoice aggregation, keyed by filter. */
export function cachedOutstanding(filter: InvoiceFilter): Promise<OutstandingAggregate> {
  return unstable_cache(() => aggregateOutstanding(filter), [keyOf("kpi:out", filter)], {
    tags: [KPI_CACHE_TAG],
    revalidate: KPI_TTL_SECONDS,
  })();
}

/** Cached time-series aggregation for monthly totals / charts. */
export function cachedByPeriod(
  filter: DashboardFilter,
  granularity: PeriodGranularity,
): Promise<PeriodPoint[]> {
  return unstable_cache(() => aggregateByPeriod(filter, granularity), [keyOf("kpi:period", filter, granularity)], {
    tags: [KPI_CACHE_TAG],
    revalidate: KPI_TTL_SECONDS,
  })();
}

/**
 * Invalidate every KPI cache entry. Call this from any mutation that changes
 * KPI-relevant data so subsequent reads reflect the new figures immediately.
 */
export function revalidateKpi(): void {
  revalidateTag(KPI_CACHE_TAG);
}
