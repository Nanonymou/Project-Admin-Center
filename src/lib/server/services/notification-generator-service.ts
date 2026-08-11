import { PERSONAS, canAccessLocation, type Persona } from "@/lib/personas";
import { SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";
import { planCutOffReminders } from "@/lib/server/services/reminder-scheduler-service";
import { insertNotifications } from "@/db/repositories/notification-repository";
import type { NewNotificationRow } from "@/db/schema";

/**
 * Notification generator (Pusat Notifikasi & Reminder) for deadlines and overdue
 * invoices. Produces per-recipient notification rows: an approaching/overdue
 * deadline becomes a notification for every persona who can see that site, and a
 * site with overdue invoices becomes an overdue-invoice notification. This is
 * what a scheduled job runs to populate each recipient's inbox; it is the
 * write-side counterpart to the read-side config inbox.
 */

/** Deadline notifications (approaching/overdue) for one recipient's sites. */
function deadlineNotifications(persona: Persona, sites: SiteKpi[]): NewNotificationRow[] {
  return buildDeadlines(sites)
    // Approvals are handled by approvalNotifications; avoid double-notifying.
    .filter((d) => d.kind !== "approval" && (d.status === "overdue" || d.status === "due_today" || d.status === "due_soon"))
    .map((d) => ({
      recipient: persona.id,
      source: "deadline",
      level: d.status === "due_soon" ? "warning" : "danger",
      title: d.title,
      detail: `PIC ${d.owner} · ${d.dueLabel}`,
      href: "/dashboard-calendar",
      projectCode: d.projectCode,
      locationId: d.locationId,
    }));
}

/** Overdue-invoice notifications for one recipient's sites. */
function overdueInvoiceNotifications(persona: Persona, sites: SiteKpi[]): NewNotificationRow[] {
  return sites
    .filter((s) => s.overdueInvoices > 0)
    .map((s) => ({
      recipient: persona.id,
      source: "reminder",
      level: s.overdueInvoices >= 3 ? "danger" : "warning",
      title: `${s.overdueInvoices} invoice overdue`,
      detail: `${s.locationName} memiliki ${s.overdueInvoices} invoice yang melewati jatuh tempo.`,
      href: "/invoices",
      projectCode: s.projectCode,
      locationId: s.locationId,
    }));
}

/**
 * Invoice-paid notifications for one recipient's sites — a settled payment
 * deadline means an invoice was paid, which is worth an informational notice
 * (positive signal, not an alert).
 */
function paidInvoiceNotifications(persona: Persona, sites: SiteKpi[]): NewNotificationRow[] {
  return buildDeadlines(sites)
    .filter((d) => d.kind === "payment" && d.status === "settled")
    .map((d) => ({
      recipient: persona.id,
      source: "system",
      level: "info",
      title: `Invoice dibayar — ${d.locationName}`,
      detail: `Pembayaran invoice dikonfirmasi (${d.projectCode}).`,
      href: "/invoices",
      projectCode: d.projectCode,
      locationId: d.locationId,
    }));
}

/**
 * Approval notifications for one recipient's sites: a late (overdue) approval is
 * an alert with days-late; a completed (settled) approval is an informational
 * notice. Covers both the "terlambat" and "selesai" cases.
 */
function approvalNotifications(persona: Persona, sites: SiteKpi[]): NewNotificationRow[] {
  return buildDeadlines(sites)
    .filter((d) => d.kind === "approval" && (d.status === "overdue" || d.status === "settled"))
    .map((d) => {
      const overdue = d.status === "overdue";
      return {
        recipient: persona.id,
        source: overdue ? "deadline" : "system",
        level: overdue ? "danger" : "info",
        title: overdue
          ? `Approval terlambat ${Math.abs(d.daysRelative)} hari — ${d.locationName}`
          : `Approval selesai — ${d.locationName}`,
        detail: overdue
          ? `${d.title} · PIC ${d.owner} belum menyetujui.`
          : `${d.title} telah disetujui.`,
        href: "/dashboard-calendar",
        projectCode: d.projectCode,
        locationId: d.locationId,
      } satisfies NewNotificationRow;
    });
}

/**
 * Incomplete-data-input notifications for one recipient's sites — reuses the
 * cut-off scheduler's data-completeness logic: a site whose period data is not
 * yet complete inside the cut-off window becomes a notification to finish entry
 * before lock, escalating with proximity.
 */
function incompleteDataNotifications(persona: Persona, sites: SiteKpi[]): NewNotificationRow[] {
  return planCutOffReminders(sites).map((r) => ({
    recipient: persona.id,
    source: "reminder",
    level: r.level === "critical" ? "danger" : r.level,
    title: `Data belum lengkap — ${r.locationName}`,
    detail: `${r.title}. Lengkapi entri sebelum penguncian cut-off.`,
    href: `/site/${r.locationId}`,
    projectCode: r.projectCode,
    locationId: r.locationId,
  }));
}

export type GeneratorResult = { recipients: number; generated: number; persisted: number };

/**
 * Generate deadline + overdue-invoice notifications for every persona, scoped to
 * the sites each may access, and persist them. Persistence is best-effort — when
 * the DB is unavailable the planned rows are still counted (persisted: 0) so the
 * caller can preview what would be created.
 */
export async function runNotificationGenerator(): Promise<GeneratorResult> {
  const rows: NewNotificationRow[] = [];
  let recipients = 0;

  for (const persona of PERSONAS) {
    const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (sites.length === 0) continue;
    const personaRows = [
      ...deadlineNotifications(persona, sites),
      ...overdueInvoiceNotifications(persona, sites),
      ...paidInvoiceNotifications(persona, sites),
      ...approvalNotifications(persona, sites),
      ...incompleteDataNotifications(persona, sites),
    ];
    if (personaRows.length > 0) recipients += 1;
    rows.push(...personaRows);
  }

  let persisted = 0;
  try {
    persisted = await insertNotifications(rows);
  } catch {
    // best-effort persistence
  }
  return { recipients, generated: rows.length, persisted };
}
