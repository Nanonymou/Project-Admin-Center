import type { MockInvoice, SiteDetail } from "./site-detail";
import type { SiteKpi } from "./site-kpi";

export type OverdueSeverity = "watch" | "critical" | "escalate";

export type OverdueInvoiceItem = {
  id: string;
  invoiceNumber: string;
  amount: number;
  projectCode: string;
  locationId: string;
  locationName: string;
  agingBucket: "0-30" | "31-60" | "61-90" | ">90";
  daysLate: number;
  dueDate: string;
  pic: string;
  severity: OverdueSeverity;
  stage: string;
  followUpsLastWeek: number;
  lastAction: string;
};

const FOLLOWUP_LABELS = [
  "Email reminder ke Finance client",
  "Call Finance Manager client",
  "Escalation ke Legal internal",
  "Follow-up di grup WhatsApp",
  "Kunjungan langsung ke kantor client",
];

const PIC_ROTATION = ["Bagas", "Ika", "Fajar", "Randi", "Dinda"];

function pickAmongDeterministic<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length];
}

function severityFor(daysLate: number): OverdueSeverity {
  if (daysLate > 60) return "escalate";
  if (daysLate > 30) return "critical";
  return "watch";
}

function stringSeed(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xffffffff;
  return hash;
}

function inferDaysLate(bucket: MockInvoice["agingBucket"], seed: number): number {
  const jitter = Math.abs(Math.sin(seed) * 15);
  if (bucket === "0-30") return Math.round(1 + jitter * 0.4);
  if (bucket === "31-60") return Math.round(35 + jitter);
  if (bucket === "61-90") return Math.round(65 + jitter);
  return Math.round(95 + jitter * 2);
}

/**
 * Configuration-driven: overdue invoice list is derived from each site's
 * mock invoice list. Only invoices with status "overdue" or in the
 * ">90" / "61-90" bucket qualify. Severity is a pure function of days late.
 */
export function buildOverdueInvoicesFor(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): OverdueInvoiceItem[] {
  const out: OverdueInvoiceItem[] = [];
  for (const site of sites) {
    const detail = detailMap[site.locationId];
    if (!detail) continue;
    detail.invoices
      .filter((inv) => inv.status === "overdue" || inv.agingBucket === ">90" || inv.agingBucket === "61-90")
      .forEach((inv, idx) => {
        const seed = stringSeed(inv.number) + idx;
        const daysLate = inferDaysLate(inv.agingBucket, seed);
        out.push({
          id: `${site.locationId}-${inv.number}`,
          invoiceNumber: inv.number,
          amount: inv.amount,
          projectCode: site.projectCode,
          locationId: site.locationId,
          locationName: site.locationName,
          agingBucket: inv.agingBucket,
          daysLate,
          dueDate: inv.dueDate,
          pic: inv.pic ?? pickAmongDeterministic(PIC_ROTATION, seed),
          severity: severityFor(daysLate),
          stage: inv.stage,
          followUpsLastWeek: Math.abs(seed % 4),
          lastAction: pickAmongDeterministic(FOLLOWUP_LABELS, seed + 3),
        });
      });
  }
  out.sort((a, b) => b.daysLate - a.daysLate);
  return out;
}

export const SEVERITY_META: Record<
  OverdueSeverity,
  { label: string; variant: "warning" | "danger"; hint: string }
> = {
  watch: { label: "Watch", variant: "warning", hint: "1-30 hari lewat due" },
  critical: { label: "Critical", variant: "danger", hint: "31-60 hari lewat due" },
  escalate: { label: "Escalate", variant: "danger", hint: ">60 hari lewat due" },
};

export const BUCKET_COLOR: Record<OverdueInvoiceItem["agingBucket"], string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

export type OverdueSummary = {
  totalCount: number;
  totalAmount: number;
  bySeverity: Record<OverdueSeverity, { count: number; amount: number }>;
};

export function summarizeOverdue(items: OverdueInvoiceItem[]): OverdueSummary {
  const bySeverity: OverdueSummary["bySeverity"] = {
    watch: { count: 0, amount: 0 },
    critical: { count: 0, amount: 0 },
    escalate: { count: 0, amount: 0 },
  };
  for (const item of items) {
    bySeverity[item.severity].count += 1;
    bySeverity[item.severity].amount += item.amount;
  }
  return {
    totalCount: items.length,
    totalAmount: items.reduce((s, i) => s + i.amount, 0),
    bySeverity,
  };
}
