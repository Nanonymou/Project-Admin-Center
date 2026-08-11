import type { SiteKpi } from "@/lib/mock/site-kpi";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { daysUntilCutOff } from "@/lib/mock/cutoff-config";
import { insertReminderLogs } from "@/db/repositories/reminder-log-repository";
import type { NewReminderLogRow } from "@/db/schema";
import { PERSONAS, canAccessLocation } from "@/lib/personas";

/**
 * Recipients for a data-completeness cut-off reminder are the Site Admins
 * responsible for entering that site's data — never Leaders/Finance/Viewers.
 * Resolves the site_admin personas whose scope covers the location.
 */
function siteAdminRecipients(locationId: string, projectCode: string): string[] {
  return PERSONAS.filter(
    (p) => p.role === "site_admin" && canAccessLocation(p, locationId, projectCode),
  ).map((p) => p.name);
}

/**
 * Cut-off reminder scheduler (Reminder Cut-Off Otomatis), driven by data
 * completeness. For each site it looks at how close the invoice cut-off is AND
 * how complete the period's data entry is, then decides which reminders to raise
 * — escalating (info → warning → critical) as the deadline nears and completeness
 * stays low. A site whose data is already complete does not get chased. The
 * planned reminders are logged to reminder_logs when persisted.
 *
 * Completeness here is a deterministic proxy derived from the site KPI (closing
 * status + pending approvals). In the real system this reads the actual daily
 * submission coverage for the open period.
 */

export type PlannedReminder = {
  locationId: string;
  locationName: string;
  projectCode: string;
  level: "info" | "warning" | "critical";
  trigger: "h_minus_7" | "h_minus_3" | "h_minus_1" | "overdue" | "closing";
  title: string;
  /** Data-completeness reminders always target the Site Admin audience. */
  audience: "Site";
  /** Resolved Site Admin recipient names for this site. */
  recipients: string[];
  completenessPct: number;
  daysToCutOff: number;
};

/** Deterministic 0..100 completeness proxy for a site's open period. */
function completenessOf(site: SiteKpi): number {
  // A locked period is complete; otherwise fewer pending approvals ⇒ more complete.
  if (site.closingStatus === "locked") return 100;
  const penalty = Math.min(60, site.pendingApprovals * 8 + site.overdueInvoices * 5);
  const base = site.closingStatus === "closing" ? 70 : 85;
  return Math.max(0, base - penalty);
}

/** The trigger bucket for a days-to-cut-off value. */
function triggerFor(days: number): PlannedReminder["trigger"] | null {
  if (days < 0) return "overdue";
  if (days === 0) return "closing";
  if (days <= 1) return "h_minus_1";
  if (days <= 3) return "h_minus_3";
  if (days <= 7) return "h_minus_7";
  return null;
}

/**
 * Compute the reminders that should fire right now across the given sites (all
 * sites by default). Only sites with incomplete data inside the reminder window
 * produce a reminder; the level escalates with proximity + incompleteness.
 */
export function planCutOffReminders(sites: SiteKpi[] = SITE_KPI): PlannedReminder[] {
  const out: PlannedReminder[] = [];

  for (const site of sites) {
    const completeness = completenessOf(site);
    if (completeness >= 100) continue; // nothing to chase

    const days = daysUntilCutOff(site.projectCode);
    const trigger = triggerFor(days);
    if (!trigger) continue; // outside the reminder window

    // Escalate: overdue/today → critical; ≤3 days & low completeness → warning.
    const level: PlannedReminder["level"] =
      days <= 0 ? "critical" : days <= 3 && completeness < 70 ? "warning" : days <= 3 ? "warning" : "info";

    // Recipients are limited to the site's Site Admins; skip if none is assigned.
    const recipients = siteAdminRecipients(site.locationId, site.projectCode);
    if (recipients.length === 0) continue;

    out.push({
      locationId: site.locationId,
      locationName: site.locationName,
      projectCode: site.projectCode,
      level,
      trigger,
      title:
        days < 0
          ? `Cut-off terlewat — data ${completeness}% lengkap`
          : days === 0
            ? `Cut-off hari ini — data ${completeness}% lengkap`
            : `Cut-off H-${days} — data ${completeness}% lengkap`,
      audience: "Site",
      recipients,
      completenessPct: completeness,
      daysToCutOff: days,
    });
  }

  return out;
}

export type SchedulerRunResult = { planned: number; logged: number; reminders: PlannedReminder[] };

/**
 * Run the scheduler: plan the reminders and persist them to reminder_logs.
 * Persistence is best-effort — if the DB is unavailable the plan is still
 * returned (logged: 0) so callers can preview what would be sent.
 */
export async function runCutOffReminderScheduler(sites: SiteKpi[] = SITE_KPI): Promise<SchedulerRunResult> {
  const reminders = planCutOffReminders(sites);
  let logged = 0;
  try {
    const rows: NewReminderLogRow[] = reminders.map((r) => ({
      level: r.level,
      trigger: r.trigger,
      title: r.title,
      channel: "in-app",
      status: "sent",
      audience: r.audience,
      projectCode: r.projectCode,
      locationId: r.locationId,
    }));
    logged = await insertReminderLogs(rows);
  } catch {
    // best-effort persistence
  }
  return { planned: reminders.length, logged, reminders };
}
