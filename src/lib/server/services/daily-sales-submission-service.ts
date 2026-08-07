import {
  getServiceCategories,
  lineTotal,
  sumSalesEntry,
  validateSalesEntry,
  type SalesEntryInput,
  type SalesValidationError,
} from "@/lib/mock/service-config";
import { getTaxConfig } from "@/lib/mock/tax-config";
import type { DailySubmissionInput, DailySubmissionLine } from "@/db/repositories/daily-transaction-repository";

export type DailySalesRequest = {
  projectId: string;
  locationId: string;
  trxDate: string; // YYYY-MM-DD
  area?: string;
  values: SalesEntryInput; // categoryKey -> { qty, price }
  submittedBy: string;
};

export type PreparedSalesSubmission =
  | { ok: true; input: DailySubmissionInput; isLate: boolean }
  | { ok: false; errors: SalesValidationError[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validate and normalize a daily-sales entry: dynamic per-project category
 * validation, line construction (deduction lines flagged, e.g. Backcharge),
 * net subtotal = gross − deductions, tax from the project's config (PPN/PB1), and
 * the H+1 late flag. Returns a persistable {@link DailySubmissionInput} or the
 * validation errors.
 */
export function prepareDailySalesSubmission(
  req: DailySalesRequest,
  ref = new Date(),
): PreparedSalesSubmission {
  const categories = getServiceCategories(req.projectId);
  const errors: SalesValidationError[] = [];

  if (!DATE_RE.test(req.trxDate)) {
    errors.push({ key: "trxDate", message: "Tanggal transaksi tidak valid (YYYY-MM-DD)." });
  }
  const today = ref.toISOString().slice(0, 10);
  if (DATE_RE.test(req.trxDate) && daysBetween(req.trxDate, today) < 0) {
    errors.push({ key: "trxDate", message: "Tanggal transaksi tidak boleh di masa depan." });
  }

  errors.push(...validateSalesEntry(categories, req.values));
  if (errors.length) return { ok: false, errors };

  const lines: DailySubmissionLine[] = categories
    .filter((c) => (req.values[c.key]?.qty || 0) > 0)
    .map((c) => {
      const line = req.values[c.key];
      const amount = lineTotal(line);
      return {
        categoryKey: c.key,
        label: c.label,
        qty: (line.qty || 0).toFixed(3),
        unitPrice: (line.price || 0).toFixed(2),
        amount: amount.toFixed(2),
        isDeduction: Boolean(c.deduction),
      };
    });

  const net = sumSalesEntry(categories, req.values);
  const tax = getTaxConfig(req.projectId);
  const taxAmount = round2(net * tax.rate);
  const isLate = daysBetween(req.trxDate, today) > 1;

  return {
    ok: true,
    isLate,
    input: {
      projectId: req.projectId,
      locationId: req.locationId,
      kind: "sales",
      trxDate: req.trxDate,
      area: req.area,
      subtotal: round2(net).toFixed(2),
      tax: taxAmount.toFixed(2),
      total: round2(net + taxAmount).toFixed(2),
      isLate,
      submittedBy: req.submittedBy,
      lines,
    },
  };
}
