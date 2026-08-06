import type { SiteKpi } from "./site-kpi";

/**
 * Invoice period / cut-off config per project — PRD Appendix §16.A.
 * "15-14" = period runs from the 15th to the 14th; "1-end" = calendar
 * month. Config-driven, keyed by project code (no hardcoded ifs).
 */
export type InvoicePeriodType = "15-14" | "1-end";

const PROJECT_PERIOD: Record<string, InvoicePeriodType> = {
  BUMA: "15-14",
  POMALA: "1-end",
  PHSS: "1-end",
  PHKT: "1-end",
};

export function getInvoicePeriodType(projectCode: string): InvoicePeriodType {
  return PROJECT_PERIOD[projectCode] ?? "1-end";
}

/** Compute the current period's cut-off (closing) date for a project. */
export function getCutOffDate(projectCode: string, ref = new Date()): Date {
  const type = getInvoicePeriodType(projectCode);
  const d = new Date(ref);
  if (type === "15-14") {
    // Closing on the 14th. If today <= 14th, this month's 14th; else next month.
    if (d.getDate() <= 14) return new Date(d.getFullYear(), d.getMonth(), 14);
    return new Date(d.getFullYear(), d.getMonth() + 1, 14);
  }
  // 1-end: closing on last day of month.
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function daysUntilCutOff(projectCode: string, ref = new Date()): number {
  const cutoff = getCutOffDate(projectCode, ref);
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  cutoff.setHours(0, 0, 0, 0);
  return Math.round((cutoff.getTime() - today.getTime()) / 86_400_000);
}

export type CutOffStatus = "on_track" | "closing_soon" | "critical" | "locked";
export type DeliveryStatus = "not_started" | "in_progress" | "sent" | "confirmed";

export type CutOffRow = {
  locationId: string;
  locationName: string;
  projectCode: string;
  periodLabel: string;
  cutOffDate: string;
  daysLeft: number;
  status: CutOffStatus;
  submittedPct: number;
  delivery: DeliveryStatus;
  pendingInvoices: number;
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

const DELIVERY_STATES: DeliveryStatus[] = ["not_started", "in_progress", "sent", "confirmed"];

export function buildCutOffRows(sites: SiteKpi[]): CutOffRow[] {
  return sites
    .map((site) => {
      const days = daysUntilCutOff(site.projectCode);
      const seed = seedOf(site.locationId);
      const submittedPct = 55 + (seed % 45);
      const status: CutOffStatus =
        submittedPct >= 100
          ? "locked"
          : days <= 0
            ? "critical"
            : days <= 2
              ? "closing_soon"
              : "on_track";
      const delivery = DELIVERY_STATES[
        days <= 0 ? 3 - (seed % 2) : Math.min(3, Math.floor(((100 - days) / 30) * 2) % 4)
      ];
      return {
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        periodLabel: site.invoicePeriod,
        cutOffDate: getCutOffDate(site.projectCode).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        daysLeft: days,
        status,
        submittedPct,
        delivery,
        pendingInvoices: site.pendingApprovals,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export const CUTOFF_STATUS_META: Record<
  CutOffStatus,
  { label: string; variant: "success" | "warning" | "danger" | "muted" }
> = {
  on_track: { label: "On Track", variant: "success" },
  closing_soon: { label: "Closing Soon", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
  locked: { label: "Locked", variant: "muted" },
};

export const DELIVERY_STATUS_META: Record<
  DeliveryStatus,
  { label: string; variant: "muted" | "info" | "warning" | "success" }
> = {
  not_started: { label: "Belum Kirim", variant: "muted" },
  in_progress: { label: "Proses", variant: "info" },
  sent: { label: "Terkirim", variant: "warning" },
  confirmed: { label: "Dikonfirmasi", variant: "success" },
};
