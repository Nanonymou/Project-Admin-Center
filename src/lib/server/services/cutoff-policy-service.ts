import {
  getCutOffDate,
  getInvoicePeriodRange,
  getInvoicePeriodType,
  daysUntilCutOff,
} from "@/lib/mock/cutoff-config";

/** H+1 grace: input remains open until one day after the period's cut-off. */
const CUTOFF_GRACE_MS = 1 * 86_400_000;

export type InputPolicyStatus = {
  projectCode: string;
  locationId: string;
  locationName?: string;
  periodType: string;
  cutOffDate: string; // YYYY-MM-DD
  daysUntilCutOff: number;
  /** Whether daily input is still open for the current period. */
  inputOpen: boolean;
  status: "open" | "closing_soon" | "closed";
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evaluate the daily-input policy for a site's current period, driven by the
 * project's cut-off config (§16.A) and the H+1 input rule. Input is "open" until
 * the cut-off date, "closing_soon" within the last two days, and "closed" once
 * the cut-off has passed. Config-driven, keyed by project code.
 */
export function evaluateInputPolicy(
  projectCode: string,
  locationId: string,
  locationName: string | undefined,
  ref = new Date(),
): InputPolicyStatus {
  const days = daysUntilCutOff(projectCode, ref);
  const cutOff = getCutOffDate(projectCode, ref);
  const status = days < 0 ? "closed" : days <= 2 ? "closing_soon" : "open";
  return {
    projectCode,
    locationId,
    locationName,
    periodType: getInvoicePeriodType(projectCode),
    cutOffDate: iso(cutOff),
    daysUntilCutOff: days,
    inputOpen: days >= 0,
    status,
  };
}

/**
 * Whether a specific transaction date may still be input under the H+1 rule: the
 * entry for date D must be input by D+1. Returns whether input is allowed and
 * whether it would be flagged late.
 */
export function evaluateInputForDate(
  trxDate: string,
  ref = new Date(),
): { allowed: boolean; late: boolean; reason: string } {
  const today = iso(ref);
  const d = new Date(`${trxDate}T00:00:00Z`).getTime();
  const t = new Date(`${today}T00:00:00Z`).getTime();
  if (Number.isNaN(d)) return { allowed: false, late: false, reason: "Tanggal tidak valid." };
  const diff = Math.round((t - d) / 86_400_000);
  if (diff < 0) return { allowed: false, late: false, reason: "Tanggal di masa depan." };
  if (diff > 1) return { allowed: true, late: true, reason: "Melewati batas H+1 (terlambat)." };
  return { allowed: true, late: false, reason: "Dalam batas H+1." };
}

/**
 * Whether input for a transaction date is closed because the date's invoice
 * period has passed its cut-off (plus the H+1 grace). Config-driven per project:
 * the period containing `trxDate` ends on its cut-off date; once `ref` is more
 * than one day past that, the period is closed for input. Reopening a period
 * (via the period-management API) is enforced separately at the DB layer.
 */
export function isInputClosedForDate(projectCode: string, trxDate: string, ref = new Date()): boolean {
  const anchor = new Date(`${trxDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) return false;
  const range = getInvoicePeriodRange(projectCode, anchor, 0);
  const cutoff = new Date(`${range.to}T00:00:00Z`).getTime();
  return ref.getTime() > cutoff + CUTOFF_GRACE_MS;
}
