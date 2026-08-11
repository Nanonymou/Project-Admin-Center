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

const MONTHS_6 = ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];

export type InvoiceTrendPoint = { month: string; count: number; issued: number; paid: number };

/**
 * Deterministic 6-month invoice trend (count + issued/paid value) from a base
 * monthly value. Mirrors the frontend chart's seeded curve so client and server
 * agree; paid trails issued to read like a collection curve.
 */
export function buildInvoiceTrend(baseMonthly: number, baseSiteCount: number): InvoiceTrendPoint[] {
  return MONTHS_6.map((month, i) => {
    const wave = 0.85 + Math.abs(Math.sin((i + 1) * 1.7)) * 0.3;
    const issued = Math.round((baseMonthly * wave) / 1000) * 1000;
    const paidRatio = 0.7 + Math.abs(Math.sin((i + 2) * 2.3)) * 0.28;
    const paid = Math.round((issued * paidRatio) / 1000) * 1000;
    // Invoice count scales with the site count and the month's wave.
    const count = Math.max(1, Math.round(baseSiteCount * (2 + Math.abs(Math.sin((i + 1) * 1.1)) * 3)));
    return { month, count, issued, paid };
  });
}

const WEEKS_6 = ["W-5", "W-4", "W-3", "W-2", "W-1", "Ini"];

export type ApprovalTrendPoint = {
  week: string;
  approved: number;
  pending: number;
  /** Average completion time for the week, in days. */
  avgDurationDays: number;
};

/**
 * Deterministic 6-week approval trend (approved vs pending counts + average
 * completion duration) from a base weekly volume. Seeded to stay stable across
 * calls; approvals dominate with a small pending tail, and duration eases as the
 * backlog clears.
 */
export function buildApprovalTrend(baseWeekly: number): ApprovalTrendPoint[] {
  const base = Math.max(6, baseWeekly);
  return WEEKS_6.map((week, i) => {
    const wave = 0.8 + Math.abs(Math.sin((i + 1) * 1.3)) * 0.5;
    const total = Math.round(base * wave);
    const pending = Math.max(0, Math.round(total * (0.1 + Math.abs(Math.sin((i + 3) * 2.1)) * 0.2)));
    const avgDurationDays = Math.round((1.5 + Math.abs(Math.sin((i + 2) * 1.9)) * 2.5) * 10) / 10;
    return { week, approved: total - pending, pending, avgDurationDays };
  });
}
