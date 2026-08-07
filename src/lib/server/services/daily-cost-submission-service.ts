import { getCostCategories, validateCostEntry, type CostValidationError } from "@/lib/mock/cost-config";
import type { DailySubmissionInput, DailySubmissionLine } from "@/db/repositories/daily-transaction-repository";

export type DailyCostSubmissionRequest = {
  projectId: string;
  locationId: string;
  trxDate: string; // YYYY-MM-DD
  area?: string;
  areaId?: string;
  values: Record<string, number>; // categoryKey -> amount
  submittedBy: string;
};

export type PreparedSubmission =
  | { ok: true; input: DailySubmissionInput; isLate: boolean }
  | { ok: false; errors: CostValidationError[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Validate and normalize a daily-cost submission: dynamic per-project category
 * validation, line construction, total = sum of category amounts, and the H+1
 * late flag (a cost for date D must be input by D+1; later submissions are
 * flagged late). Returns a persistable {@link DailySubmissionInput} or the
 * validation errors. Cost carries no tax, so tax = 0 and total = subtotal.
 */
export function prepareDailyCostSubmission(
  req: DailyCostSubmissionRequest,
  ref = new Date(),
): PreparedSubmission {
  const categories = getCostCategories(req.projectId);
  const errors: CostValidationError[] = [];

  if (!DATE_RE.test(req.trxDate)) {
    errors.push({ key: "trxDate", message: "Tanggal transaksi tidak valid (YYYY-MM-DD)." });
  }
  const today = ref.toISOString().slice(0, 10);
  if (DATE_RE.test(req.trxDate) && daysBetween(req.trxDate, today) < 0) {
    errors.push({ key: "trxDate", message: "Tanggal transaksi tidak boleh di masa depan." });
  }

  errors.push(...validateCostEntry(categories, req.values));
  if (errors.length) return { ok: false, errors };

  const lines: DailySubmissionLine[] = categories
    .filter((c) => (req.values[c.key] || 0) > 0)
    .map((c) => {
      const amount = req.values[c.key] || 0;
      return {
        categoryKey: c.key,
        label: c.label,
        qty: "1",
        unitPrice: amount.toFixed(2),
        amount: amount.toFixed(2),
        isDeduction: false,
      };
    });

  const subtotal = lines.reduce((s, l) => s + Number(l.amount), 0);
  const isLate = daysBetween(req.trxDate, today) > 1;

  return {
    ok: true,
    isLate,
    input: {
      projectId: req.projectId,
      locationId: req.locationId,
      kind: "cost",
      trxDate: req.trxDate,
      area: req.area,
      areaId: req.areaId,
      subtotal: subtotal.toFixed(2),
      tax: "0.00",
      total: subtotal.toFixed(2),
      isLate,
      submittedBy: req.submittedBy,
      lines,
    },
  };
}
