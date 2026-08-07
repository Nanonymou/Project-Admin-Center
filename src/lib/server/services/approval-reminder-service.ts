import { buildApprovalReminders } from "@/lib/mock/approvals";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import type { SiteDetail } from "@/lib/mock/site-detail";

export type ApprovalReminderSummary = {
  projectId: string;
  locationId: string;
  locationName: string;
  pending: number;
  atRisk: number;
  overdue: number;
  avgTimeInStage: number;
  worstBreachDays: number;
};

/**
 * Approval reminder data per site — counts of pending / at-risk / overdue
 * approvals plus average time-in-stage and the worst SLA breach. Orchestrates
 * the approval reminder builder per site; sorted most urgent first.
 */
export function buildApprovalReminderSummaries(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): ApprovalReminderSummary[] {
  return sites
    .map((site) => {
      const detail = detailMap[site.locationId];
      const reminders = detail ? buildApprovalReminders(site, detail) : [];
      const overdue = reminders.filter((a) => a.status === "overdue" || a.status === "escalation").length;
      const atRisk = reminders.filter((a) => a.status === "at_risk").length;
      const worstBreach = reminders.reduce((m, a) => Math.max(m, a.timeInStageDays - a.slaTargetDays), 0);
      const avg = reminders.length
        ? reminders.reduce((x, a) => x + a.timeInStageDays, 0) / reminders.length
        : 0;
      return {
        projectId: site.projectCode,
        locationId: site.locationId,
        locationName: site.locationName,
        pending: reminders.length,
        atRisk,
        overdue,
        avgTimeInStage: avg,
        worstBreachDays: Math.max(0, worstBreach),
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.atRisk - a.atRisk);
}
