import type { Persona } from "@/lib/personas";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminders } from "@/lib/mock/reminders";
import { buildDeadlines } from "@/lib/mock/deadlines";

/**
 * Config-derived notification inbox (Pusat Notifikasi & Reminder). Merges cut-off
 * reminders and deadline notifications across a persona's accessible sites into
 * one urgency-ranked feed, mirroring the frontend inbox. Used as the fallback for
 * the notification endpoints when the notifications table has no rows (frontend-
 * first). Ids are stable so a listed entry resolves in the detail endpoint.
 */

export type InboxNotification = {
  id: string;
  source: "reminder" | "deadline";
  level: "info" | "warning" | "danger";
  title: string;
  detail: string;
  projectCode: string;
  locationId: string;
  location: string;
  dueLabel: string;
  href: string;
  order: number;
};

function deadlineHref(kind: string, locationId: string): string {
  if (kind === "invoice_submit" || kind === "payment") return "/invoices";
  if (kind === "approval") return "/dashboard-calendar";
  if (kind === "closing") return `/site/${locationId}`;
  return "/dashboard-calendar";
}

/** Build the persona's unified inbox, most-urgent first. */
export function buildNotificationInbox(persona: Persona): InboxNotification[] {
  const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  const out: InboxNotification[] = [];

  for (const site of sites) {
    for (const r of buildReminders(site)) {
      out.push({
        id: `rem-${r.id}`,
        source: "reminder",
        level: r.level === "critical" ? "danger" : r.level,
        title: r.title,
        detail: r.detail,
        projectCode: site.projectCode,
        locationId: site.locationId,
        location: `${site.locationName} · ${site.projectCode}`,
        dueLabel: r.dueLabel,
        href: `/site/${site.locationId}`,
        order: r.level === "critical" ? 0 : r.level === "warning" ? 1 : 2,
      });
    }
  }

  for (const d of buildDeadlines(sites)) {
    const level: InboxNotification["level"] =
      d.status === "overdue" || d.status === "due_today" ? "danger" : d.status === "due_soon" ? "warning" : "info";
    out.push({
      id: `dl-${d.id}`,
      source: "deadline",
      level,
      title: d.title,
      detail: `PIC ${d.owner} · progres ${d.progressPct}%`,
      projectCode: d.projectCode,
      locationId: d.locationId,
      location: `${d.locationName} · ${d.projectCode}`,
      dueLabel: d.dueLabel,
      href: deadlineHref(d.kind, d.locationId),
      order: d.daysRelative,
    });
  }

  return out.sort((a, b) => a.order - b.order);
}
