import { daysUntilCutOff, getCutOffDate, getInvoicePeriodType } from "@/lib/mock/cutoff-config";

export type ReminderSeverity = "on_track" | "closing_soon" | "critical" | "overdue";

export type DeadlineReminder = {
  projectId: string;
  locationId: string;
  locationName?: string;
  periodType: string;
  cutOffDate: string; // YYYY-MM-DD
  daysLeft: number;
  severity: ReminderSeverity;
};

export type ReminderSiteInput = {
  projectCode: string;
  locationId: string;
  locationName?: string;
};

function severityFor(daysLeft: number): ReminderSeverity {
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "critical";
  if (daysLeft <= 2) return "closing_soon";
  return "on_track";
}

/**
 * Deadline reminder data per site — cut-off date, days remaining and severity,
 * derived from each project's config-driven invoice period. Pure/testable so it
 * can back the reminder widget endpoint. Sorted most urgent first.
 */
export function buildDeadlineReminders(sites: ReminderSiteInput[], ref = new Date()): DeadlineReminder[] {
  return sites
    .map((s) => {
      const daysLeft = daysUntilCutOff(s.projectCode, ref);
      const cutoff = getCutOffDate(s.projectCode, ref);
      return {
        projectId: s.projectCode,
        locationId: s.locationId,
        locationName: s.locationName,
        periodType: getInvoicePeriodType(s.projectCode),
        cutOffDate: cutoff.toISOString().slice(0, 10),
        daysLeft,
        severity: severityFor(daysLeft),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Count reminders by severity — useful for widget summary badges. */
export function summarizeReminders(reminders: DeadlineReminder[]): Record<ReminderSeverity, number> {
  const out: Record<ReminderSeverity, number> = { on_track: 0, closing_soon: 0, critical: 0, overdue: 0 };
  for (const r of reminders) out[r.severity] += 1;
  return out;
}
