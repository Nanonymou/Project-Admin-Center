import type { SiteKpi } from "./site-kpi";

export type DeadlineKind = "closing" | "invoice_submit" | "approval" | "payment" | "audit";
export type DeadlineStatus = "on_track" | "due_soon" | "due_today" | "overdue" | "settled";

export type DeadlineItem = {
  id: string;
  kind: DeadlineKind;
  title: string;
  target: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  owner: string;
  dueDate: string; // ISO
  dueLabel: string;
  daysRelative: number;
  status: DeadlineStatus;
  progressPct: number;
};

const KIND_TITLE: Record<DeadlineKind, string> = {
  closing: "Closing Period",
  invoice_submit: "Submit Invoice ke Client",
  approval: "Approval Leader",
  payment: "Payment Confirmation",
  audit: "Audit Support",
};

function computeStatus(dayDelta: number, progress: number): DeadlineStatus {
  if (progress >= 100) return "settled";
  if (dayDelta < 0) return "overdue";
  if (dayDelta === 0) return "due_today";
  if (dayDelta <= 3) return "due_soon";
  return "on_track";
}

function daysLabel(diff: number): string {
  if (diff === 0) return "hari ini";
  if (diff > 0) return `${diff} hari lagi`;
  return `terlambat ${Math.abs(diff)} hari`;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function seededProgress(seed: number, base: number) {
  const jitter = Math.sin(seed) * 10000;
  const frac = jitter - Math.floor(jitter);
  return Math.min(100, Math.max(0, Math.round(base + (frac - 0.5) * 40)));
}

export function buildDeadlines(sites: SiteKpi[]): DeadlineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: DeadlineItem[] = [];

  sites.forEach((site, idx) => {
    const owner =
      site.projectCode === "BUMA"
        ? "Bagas Wicaksono"
        : site.projectCode === "POMALA"
          ? "Ika Rahmawati"
          : site.projectCode === "PHSS"
            ? "Fajar Nugraha"
            : "Randi Setiawan";

    // Closing deadline
    const closingDate = new Date(today);
    closingDate.setDate(closingDate.getDate() + site.cutOffDaysLeft);
    items.push({
      id: `${site.locationId}-closing`,
      kind: "closing",
      title: KIND_TITLE.closing,
      target: `Periode invoice ${site.invoicePeriod}`,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      owner: "Site Admin",
      dueDate: iso(closingDate),
      dueLabel: daysLabel(site.cutOffDaysLeft),
      daysRelative: site.cutOffDaysLeft,
      status: computeStatus(site.cutOffDaysLeft, 55),
      progressPct: seededProgress(idx * 7 + 1, 55),
    });

    // Invoice submit deadline (usually cut-off + 5)
    const submitDelta = site.cutOffDaysLeft + 5;
    const submitDate = new Date(today);
    submitDate.setDate(submitDate.getDate() + submitDelta);
    items.push({
      id: `${site.locationId}-submit`,
      kind: "invoice_submit",
      title: KIND_TITLE.invoice_submit,
      target: `${site.pendingApprovals} invoice pending submit`,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      owner,
      dueDate: iso(submitDate),
      dueLabel: daysLabel(submitDelta),
      daysRelative: submitDelta,
      status: computeStatus(submitDelta, 40),
      progressPct: seededProgress(idx * 7 + 2, 40),
    });

    // Approval Leader deadline (2 days out)
    const approvalDelta = 2 - (idx % 4);
    const approvalDate = new Date(today);
    approvalDate.setDate(approvalDate.getDate() + approvalDelta);
    items.push({
      id: `${site.locationId}-approval`,
      kind: "approval",
      title: KIND_TITLE.approval,
      target: `${site.pendingApprovals} invoice antri approval`,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      owner: "Leader Admin",
      dueDate: iso(approvalDate),
      dueLabel: daysLabel(approvalDelta),
      daysRelative: approvalDelta,
      status: computeStatus(approvalDelta, 65),
      progressPct: seededProgress(idx * 7 + 3, 65),
    });

    // Payment confirmation (dependent on overdue count)
    if (site.overdueInvoices > 0) {
      const paymentDelta = -Math.min(30, site.overdueInvoices * 4);
      const paymentDate = new Date(today);
      paymentDate.setDate(paymentDate.getDate() + paymentDelta);
      items.push({
        id: `${site.locationId}-payment`,
        kind: "payment",
        title: KIND_TITLE.payment,
        target: `${site.overdueInvoices} invoice overdue`,
        projectCode: site.projectCode,
        locationId: site.locationId,
        locationName: site.locationName,
        owner: "Finance Client",
        dueDate: iso(paymentDate),
        dueLabel: daysLabel(paymentDelta),
        daysRelative: paymentDelta,
        status: computeStatus(paymentDelta, 20),
        progressPct: seededProgress(idx * 7 + 4, 20),
      });
    }
  });

  return items.sort((a, b) => a.daysRelative - b.daysRelative);
}

export const STATUS_META: Record<
  DeadlineStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "muted" }
> = {
  on_track: { label: "On Track", variant: "info" },
  due_soon: { label: "Due Soon", variant: "warning" },
  due_today: { label: "Due Today", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  settled: { label: "Settled", variant: "success" },
};

export const KIND_META: Record<DeadlineKind, { label: string }> = {
  closing: { label: "Closing" },
  invoice_submit: { label: "Submit Invoice" },
  approval: { label: "Approval" },
  payment: { label: "Payment" },
  audit: { label: "Audit" },
};
