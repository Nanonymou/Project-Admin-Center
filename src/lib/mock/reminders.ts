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

export type ReminderHistoryStatus = "sent" | "acknowledged" | "escalated";

export type ReminderHistoryEntry = {
  id: string;
  level: ReminderLevel;
  trigger: ReminderTrigger;
  title: string;
  channel: "email" | "in-app" | "whatsapp";
  status: ReminderHistoryStatus;
  audience: "Leader" | "Site" | "Finance";
  locationId: string;
  locationName: string;
  projectCode: string;
  sentAt: string; // ISO
  sentRelative: string;
};

const CHANNELS: ReminderHistoryEntry["channel"][] = ["email", "in-app", "whatsapp"];
const HISTORY_STATUSES: ReminderHistoryStatus[] = ["sent", "acknowledged", "escalated"];

function historySeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/**
 * Build a seeded history of reminders that have already been dispatched for a
 * site — the "Riwayat Reminder" view. Deterministic per site so each shows its
 * own past trail (sent → acknowledged / escalated), newest first. No backend.
 */
export function buildReminderHistory(site: SiteKpi): ReminderHistoryEntry[] {
  const base = buildReminders(site);
  const seed = historySeed(site.locationId);
  const out: ReminderHistoryEntry[] = [];

  base.forEach((r, i) => {
    // Emit one or two past dispatches per current reminder.
    const dispatches = 1 + ((seed + i) % 2);
    for (let d = 0; d < dispatches; d++) {
      const daysAgo = (i + 1) * 3 + d * 2 + (seed % 4);
      const at = new Date();
      at.setDate(at.getDate() - daysAgo);
      at.setHours(8 + ((seed + i + d) % 9), (seed * (i + 1)) % 60, 0, 0);
      out.push({
        id: `${r.id}-h${d}`,
        level: r.level,
        trigger: r.trigger,
        title: r.title,
        channel: CHANNELS[(seed + i + d) % CHANNELS.length],
        status: HISTORY_STATUSES[(seed + i + d) % HISTORY_STATUSES.length],
        audience: r.audience,
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        sentAt: at.toISOString(),
        sentRelative: daysAgo === 0 ? "hari ini" : `${daysAgo} hari lalu`,
      });
    }
  });

  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
