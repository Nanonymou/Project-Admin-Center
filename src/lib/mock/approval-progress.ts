import type { ApprovalReminder } from "./approvals";

export const APPROVAL_STAGES = [
  "Verifikasi Site",
  "Approval Leader",
  "Verifikasi Finance",
  "Kirim Client",
  "Payment",
] as const;

export type ApprovalStageName = (typeof APPROVAL_STAGES)[number];

export type StageProgress = {
  stage: ApprovalStageName;
  index: number;
  total: number;
  onTime: number;
  atRisk: number;
  overdue: number;
  amount: number;
};

/**
 * Roll up an approval-reminder list into per-stage progress, treating the
 * ordered stage list as a funnel.
 */
export function buildStageProgress(reminders: ApprovalReminder[]): StageProgress[] {
  return APPROVAL_STAGES.map((stage, index) => {
    const rows = reminders.filter((r) => r.stage === stage);
    return {
      stage,
      index,
      total: rows.length,
      onTime: rows.filter((r) => r.status === "on_time").length,
      atRisk: rows.filter((r) => r.status === "at_risk").length,
      overdue: rows.filter((r) => r.status === "overdue" || r.status === "escalation").length,
      amount: rows.reduce((s, r) => s + r.amount, 0),
    };
  });
}

export type ApprovalProgressSummary = {
  total: number;
  onTime: number;
  atRisk: number;
  overdue: number;
  completionPct: number; // share already at Payment/settled among all
};

export function summarizeApprovalProgress(
  reminders: ApprovalReminder[],
  settledCount: number,
): ApprovalProgressSummary {
  const total = reminders.length + settledCount;
  const onTime = reminders.filter((r) => r.status === "on_time").length;
  const atRisk = reminders.filter((r) => r.status === "at_risk").length;
  const overdue = reminders.filter(
    (r) => r.status === "overdue" || r.status === "escalation",
  ).length;
  return {
    total,
    onTime,
    atRisk,
    overdue,
    completionPct: total === 0 ? 0 : (settledCount / total) * 100,
  };
}
