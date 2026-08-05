import { APPROVAL_STAGES, type ApprovalStageName } from "./approval-progress";
import type { MockInvoice, SiteDetail } from "./site-detail";

export type TimelineStageState = "done" | "current" | "upcoming" | "overdue";

export type TimelineStage = {
  stage: ApprovalStageName;
  state: TimelineStageState;
  startOffset: number; // days from invoice creation
  durationDays: number;
  slaDays: number;
  breachedSla: boolean;
  actor: string;
};

export type InvoiceTimeline = {
  invoiceNumber: string;
  amount: number;
  pic: string;
  status: MockInvoice["status"];
  currentStage: ApprovalStageName;
  totalElapsedDays: number;
  stages: TimelineStage[];
};

const STAGE_SLA: Record<ApprovalStageName, number> = {
  "Verifikasi Site": 2,
  "Approval Leader": 3,
  "Verifikasi Finance": 3,
  "Kirim Client": 2,
  Payment: 30,
};

const STAGE_ACTOR: Record<ApprovalStageName, string> = {
  "Verifikasi Site": "Site Admin",
  "Approval Leader": "Leader Admin",
  "Verifikasi Finance": "Finance HO",
  "Kirim Client": "Site Admin",
  Payment: "Finance Client",
};

function seed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function buildInvoiceTimeline(inv: MockInvoice): InvoiceTimeline {
  const currentIdx = Math.max(
    0,
    (APPROVAL_STAGES as readonly string[]).indexOf(inv.stage),
  );
  let offset = 0;
  const s = seed(inv.number);

  const stages: TimelineStage[] = APPROVAL_STAGES.map((stage, i) => {
    const sla = STAGE_SLA[stage];
    let state: TimelineStageState;
    let duration: number;
    if (i < currentIdx) {
      // completed stage — some may have breached SLA
      duration = Math.max(1, Math.round(sla * (0.6 + rand(s + i) * 0.9)));
      state = "done";
    } else if (i === currentIdx) {
      duration = Math.max(1, Math.round(sla * (0.5 + rand(s + i) * 1.2)));
      state = inv.status === "overdue" ? "overdue" : "current";
    } else {
      duration = sla;
      state = "upcoming";
    }
    const startOffset = offset;
    if (i <= currentIdx) offset += duration;
    return {
      stage,
      state,
      startOffset,
      durationDays: duration,
      slaDays: sla,
      breachedSla: i <= currentIdx && duration > sla,
      actor: STAGE_ACTOR[stage],
    };
  });

  return {
    invoiceNumber: inv.number,
    amount: inv.amount,
    pic: inv.pic,
    status: inv.status,
    currentStage: inv.stage as ApprovalStageName,
    totalElapsedDays: offset,
    stages,
  };
}

/**
 * Build per-invoice approval timelines for a site (Gantt-style stage
 * transitions). Payment-only settled invoices are excluded — they no
 * longer have an active approval flow.
 */
export function buildSiteApprovalTimelines(detail: SiteDetail): InvoiceTimeline[] {
  return detail.invoices
    .filter((inv) => inv.stage !== "Payment" || inv.status === "overdue")
    .map(buildInvoiceTimeline)
    .sort((a, b) => b.totalElapsedDays - a.totalElapsedDays);
}
