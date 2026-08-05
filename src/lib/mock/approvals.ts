import type { MockInvoice, SiteDetail } from "./site-detail";
import type { SiteKpi } from "./site-kpi";

export type ApprovalReminderStatus =
  | "on_time"
  | "at_risk"
  | "overdue"
  | "escalation"
  | "approved";

export type ApprovalReminderPriority = "low" | "medium" | "high";

export type ApprovalReminder = {
  id: string;
  invoiceNumber: string;
  amount: number;
  projectCode: string;
  locationId: string;
  locationName: string;
  stage: string;
  status: ApprovalReminderStatus;
  priority: ApprovalReminderPriority;
  timeInStageDays: number;
  slaTargetDays: number;
  assignee: string;
  submittedAt: string;
  dueLabel: string;
};

const STAGE_SLA: Record<string, number> = {
  "Verifikasi Site": 2,
  "Approval Leader": 3,
  "Verifikasi Finance": 3,
  "Kirim Client": 2,
  Payment: 30,
};

function seedFrom(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function statusFor(timeIn: number, sla: number, invoiceStatus: MockInvoice["status"]): ApprovalReminderStatus {
  if (invoiceStatus === "overdue" || timeIn > sla * 1.5) return "escalation";
  if (invoiceStatus === "atRisk" || timeIn > sla) return "overdue";
  if (timeIn > sla * 0.7) return "at_risk";
  return "on_time";
}

function priorityFor(amount: number): ApprovalReminderPriority {
  if (amount > 200_000_000) return "high";
  if (amount > 50_000_000) return "medium";
  return "low";
}

function ownerFor(stage: string, project: string): string {
  if (stage === "Verifikasi Site" || stage === "Kirim Client") {
    return `Site Admin ${project}`;
  }
  if (stage === "Approval Leader") return "Leader Admin";
  if (stage === "Verifikasi Finance") return "Finance HO";
  return "Finance Client";
}

function offsetLabel(days: number, sla: number) {
  const delta = sla - days;
  if (delta > 0) return `SLA masih ${delta} hari`;
  if (delta === 0) return "SLA jatuh tempo hari ini";
  return `SLA lewat ${Math.abs(delta)} hari`;
}

/**
 * Configuration-driven: each site's approval reminders are derived from
 * its invoice list + stage SLA table. Payment-stage invoices are treated
 * as "approved" for the purposes of an approval-reminder queue.
 */
export function buildApprovalReminders(site: SiteKpi, detail: SiteDetail): ApprovalReminder[] {
  const out: ApprovalReminder[] = [];
  detail.invoices.forEach((inv, idx) => {
    if (inv.stage === "Payment") return; // exit — no approval action needed
    const seed = seedFrom(inv.number) + idx;
    const sla = STAGE_SLA[inv.stage] ?? 3;
    const timeIn = Math.max(1, Math.round(rand(seed) * (sla + 3)));
    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - timeIn);
    const status = statusFor(timeIn, sla, inv.status);
    out.push({
      id: `${site.locationId}-${inv.number}`,
      invoiceNumber: inv.number,
      amount: inv.amount,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      stage: inv.stage,
      status,
      priority: priorityFor(inv.amount),
      timeInStageDays: timeIn,
      slaTargetDays: sla,
      assignee: ownerFor(inv.stage, site.projectCode),
      submittedAt: submittedAt.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      dueLabel: offsetLabel(timeIn, sla),
    });
  });
  return out;
}

export function buildApprovalRemindersFor(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): ApprovalReminder[] {
  const out: ApprovalReminder[] = [];
  for (const site of sites) {
    const detail = detailMap[site.locationId];
    if (!detail) continue;
    out.push(...buildApprovalReminders(site, detail));
  }
  const rank: Record<ApprovalReminderStatus, number> = {
    escalation: 0,
    overdue: 1,
    at_risk: 2,
    on_time: 3,
    approved: 4,
  };
  out.sort((a, b) => rank[a.status] - rank[b.status]);
  return out;
}

export const APPROVAL_STATUS_META: Record<
  ApprovalReminderStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "muted" }
> = {
  on_time: { label: "On Time", variant: "info" },
  at_risk: { label: "At Risk", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  escalation: { label: "Escalation", variant: "danger" },
  approved: { label: "Approved", variant: "success" },
};
