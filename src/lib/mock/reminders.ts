import type { SiteKpi } from "./site-kpi";

export type ReminderLevel = "info" | "warning" | "critical";
export type ReminderTrigger = "h_minus_7" | "h_minus_3" | "h_minus_1" | "overdue" | "closing";

export type ReminderItem = {
  id: string;
  level: ReminderLevel;
  trigger: ReminderTrigger;
  title: string;
  detail: string;
  target: string;
  audience: "Leader" | "Site" | "Finance";
  dueLabel: string;
  createdRelative: string;
  acknowledged?: boolean;
};

const TRIGGER_LABEL: Record<ReminderTrigger, string> = {
  h_minus_7: "H-7 Due Date",
  h_minus_3: "H-3 Due Date",
  h_minus_1: "H-1 Due Date",
  overdue: "Overdue",
  closing: "Closing Period",
};

export function reminderTriggerLabel(t: ReminderTrigger) {
  return TRIGGER_LABEL[t];
}

/**
 * Configuration Driven: reminder set derives from Project + Site KPI —
 * exactly per PRD §16.E (Reminder Matrix). No hardcoded per-project ifs
 * in the UI; the shape drives what the widget shows.
 */
export function buildReminders(site: SiteKpi): ReminderItem[] {
  const items: ReminderItem[] = [];
  const project = site.projectCode;

  // H-7 — only Leader for BUMA per matrix
  if (project === "BUMA") {
    items.push({
      id: `${site.locationId}-h7`,
      level: "info",
      trigger: "h_minus_7",
      title: "H-7 Due Date invoice periode berjalan",
      detail: "Verifikasi pre-invoice bulan ini agar target closing tercapai.",
      target: `Periode ${site.invoicePeriod}`,
      audience: "Leader",
      dueLabel: "7 hari lagi",
      createdRelative: "2 jam lalu",
    });
  }

  // H-3 — Site for BUMA/POMALA, Leader for PHSS/PHKT
  const h3Aud = project === "BUMA" || project === "POMALA" ? "Site" : "Leader";
  items.push({
    id: `${site.locationId}-h3`,
    level: "warning",
    trigger: "h_minus_3",
    title: "H-3 Due Date — periksa kelengkapan berkas",
    detail: `Notifikasi ${h3Aud} untuk finalisasi invoice batch.`,
    target: `Periode ${site.invoicePeriod}`,
    audience: h3Aud,
    dueLabel: "3 hari lagi",
    createdRelative: "6 jam lalu",
  });

  // H-1 — critical alert for all
  items.push({
    id: `${site.locationId}-h1`,
    level: "critical",
    trigger: "h_minus_1",
    title: "H-1 — kirim invoice ke client hari ini",
    detail: "Alert high — batas akhir submit invoice besok pagi.",
    target: `${site.pendingApprovals} invoice pending`,
    audience: "Leader",
    dueLabel: "besok",
    createdRelative: "1 jam lalu",
  });

  // Overdue — one per overdue invoice on this site
  if (site.overdueInvoices > 0) {
    items.push({
      id: `${site.locationId}-overdue`,
      level: "critical",
      trigger: "overdue",
      title: `${site.overdueInvoices} invoice overdue butuh eskalasi`,
      detail: "Escalation aktif — hubungi finance client untuk konfirmasi payment.",
      target: `${site.overdueInvoices} invoice`,
      audience: "Leader",
      dueLabel: "sudah lewat",
      createdRelative: "30 mnt lalu",
    });
  }

  // Closing Period reminder based on cut-off
  if (site.cutOffDaysLeft <= 3 && site.cutOffDaysLeft >= 0) {
    items.push({
      id: `${site.locationId}-closing`,
      level: site.cutOffDaysLeft <= 1 ? "critical" : "warning",
      trigger: "closing",
      title: `Closing period ${site.cutOffDaysLeft <= 0 ? "hari ini" : `H-${site.cutOffDaysLeft}`}`,
      detail: "Pastikan seluruh Daily Sales & Cost sudah tersubmit sebelum lock otomatis.",
      target: `Periode ${site.invoicePeriod}`,
      audience: "Site",
      dueLabel: site.cutOffDaysLeft <= 0 ? "hari ini" : `${site.cutOffDaysLeft} hari lagi`,
      createdRelative: "kemarin",
    });
  }

  return items;
}
