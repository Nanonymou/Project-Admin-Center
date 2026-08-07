import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/**
 * Approval stage timeframes (SLA in days) per subject type — config-driven and
 * keyed by project code. The default flow applies to every project; override a
 * project by adding an entry to PROJECT_OVERRIDES. Used to seed the master
 * timeframe table and to compute at-risk / breached approval stages.
 */
export type ApprovalTimeframe = { stage: string; slaDays: number; order: number };

const INVOICE_FLOW: ApprovalTimeframe[] = [
  { stage: "Verifikasi Site", slaDays: 2, order: 0 },
  { stage: "Approval Leader", slaDays: 3, order: 1 },
  { stage: "Verifikasi Finance", slaDays: 3, order: 2 },
  { stage: "Kirim Client", slaDays: 2, order: 3 },
  { stage: "Payment", slaDays: 30, order: 4 },
];

const DAILY_CLOSING_FLOW: ApprovalTimeframe[] = [
  { stage: "Verifikasi Site", slaDays: 1, order: 0 },
  { stage: "Approval Leader", slaDays: 1, order: 1 },
];

const DEFAULT_FLOWS: Record<string, ApprovalTimeframe[]> = {
  invoice: INVOICE_FLOW,
  daily_closing: DAILY_CLOSING_FLOW,
};

/** Per-project overrides (empty by default; every project uses the default flow). */
const PROJECT_OVERRIDES: Record<string, Record<string, ApprovalTimeframe[]>> = {};

export function getApprovalTimeframes(
  projectCode: string,
  subjectType: "invoice" | "daily_closing" = "invoice",
): ApprovalTimeframe[] {
  return PROJECT_OVERRIDES[projectCode]?.[subjectType] ?? DEFAULT_FLOWS[subjectType] ?? INVOICE_FLOW;
}

/** Distinct configured project codes, sourced from the workspace config. */
export function timeframeProjectCodes(): string[] {
  return Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));
}
