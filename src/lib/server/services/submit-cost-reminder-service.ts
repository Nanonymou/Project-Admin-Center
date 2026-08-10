import {
  listDailySubmissionsBatch,
  type DailySubmissionFilter,
} from "@/db/repositories/daily-submission-repository";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import type { Persona } from "@/lib/personas";
import { canAccessLocation } from "@/lib/personas";

/**
 * Automatic Submit Daily Cost reminders. For a given date, compares the sites a
 * persona can see against the batch submissions already recorded and returns a
 * reminder per site that has not yet submitted its Daily Cost. Reads submissions
 * through the repository; when the DB is unavailable it treats all sites as
 * un-submitted (so the reminder still fires) and marks the source as "mock".
 */

export type SubmitReminder = {
  projectCode: string;
  locationId: string;
  locationName: string;
  submissionDate: string;
  severity: "info" | "warning";
  message: string;
};

export type SubmitReminderResult = {
  source: "db" | "mock";
  date: string;
  pending: SubmitReminder[];
  submittedCount: number;
  pendingCount: number;
};

export async function buildSubmitCostReminders(
  persona: Persona,
  submissionDate: string,
  projectId?: string,
): Promise<SubmitReminderResult> {
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (projectId) sites = sites.filter((s) => s.projectCode === projectId);

  const filter: DailySubmissionFilter = {
    projectId,
    kind: "cost",
    scope: projectId ? "tenant" : "executive",
    limit: 500,
  };

  let submittedLocationIds = new Set<string>();
  let source: "db" | "mock" = "db";
  try {
    const rows = await listDailySubmissionsBatch(filter);
    submittedLocationIds = new Set(
      rows.filter((r) => r.submissionDate === submissionDate).map((r) => r.locationId),
    );
  } catch {
    source = "mock";
  }

  // How late is the reminder — an older date is more urgent.
  const daysLate = Math.max(
    0,
    Math.round((Date.now() - new Date(`${submissionDate}T00:00:00Z`).getTime()) / 86_400_000),
  );
  const severity: SubmitReminder["severity"] = daysLate >= 1 ? "warning" : "info";

  const pending: SubmitReminder[] = sites
    .filter((s) => !submittedLocationIds.has(s.locationId))
    .map((s) => ({
      projectCode: s.projectCode,
      locationId: s.locationId,
      locationName: s.locationName,
      submissionDate,
      severity,
      message:
        daysLate >= 1
          ? `Daily Cost ${s.locationName} untuk ${submissionDate} belum disubmit (H+${daysLate}).`
          : `Daily Cost ${s.locationName} untuk ${submissionDate} belum disubmit.`,
    }));

  return {
    source,
    date: submissionDate,
    pending,
    submittedCount: submittedLocationIds.size,
    pendingCount: pending.length,
  };
}
