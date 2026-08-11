import { PERSONAS, canAccessLocation, type Persona } from "@/lib/personas";
import { SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";
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
    .filter((d) => d.status === "overdue" || d.status === "due_today" || d.status === "due_soon")
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
    const personaRows = [...deadlineNotifications(persona, sites), ...overdueInvoiceNotifications(persona, sites)];
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
