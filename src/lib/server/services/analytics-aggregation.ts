import type { Persona } from "@/lib/personas";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";

/**
 * Analytics aggregation helpers (Analytics Dashboard backend). Centralizes how
 * the analytics endpoints resolve the persona's in-scope sites (with optional
 * project/location narrowing) and compute the shared trend series, so each
 * endpoint stays a thin wrapper and the math lives in one place. Config-derived
 * from SITE_KPI — no backend/DB dependency.
 */

export type AnalyticsScope = { projectId?: string; locationId?: string };

/** The sites a persona may see, narrowed by an optional project/location filter. */
export function resolveScopedSites(persona: Persona, scope: AnalyticsScope = {}): SiteKpi[] {
  return SITE_KPI.filter(
    (s) =>
      canAccessLocation(persona, s.locationId, s.projectCode) &&
      (!scope.projectId || s.projectCode === scope.projectId) &&
      (!scope.locationId || s.locationId === scope.locationId),
  );
}

export type DailyPoint = { day: string; date: string; sales: number; cost: number; profit: number };

/**
 * Aggregate the per-site 7-day sales/cost trend into a single daily series, with
 * profit derived. Days are aligned by the trend7d day label and dated backwards
 * from today.
 */
export function aggregateSalesCostTrend(sites: SiteKpi[]): DailyPoint[] {
  const byDay = new Map<string, { sales: number; cost: number }>();
  const order: string[] = [];
  for (const site of sites) {
    for (const p of site.trend7d) {
      if (!byDay.has(p.day)) {
        byDay.set(p.day, { sales: 0, cost: 0 });
        order.push(p.day);
      }
      const acc = byDay.get(p.day)!;
      acc.sales += p.sales;
      acc.cost += p.cost;
    }
  }
  const today = new Date();
  return order.map((day, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (order.length - 1 - i));
    const agg = byDay.get(day)!;
    return {
      day,
      date: d.toISOString().slice(0, 10),
      sales: agg.sales,
      cost: agg.cost,
      profit: agg.sales - agg.cost,
    };
  });
}
