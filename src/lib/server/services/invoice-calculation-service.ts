import { getTaxConfig } from "@/lib/mock/tax-config";
import { getPenaltyConfig } from "@/lib/mock/penalty-config";

export type InvoiceCalcInput = {
  projectCode: string;
  subtotal: number;
  /** Deductions (e.g. backcharge) that reduce the taxable base. */
  deduction?: number;
  /** Days overdue; drives the late-payment penalty. */
  overdueDays?: number;
};

export type InvoiceCalc = {
  subtotal: number;
  deduction: number;
  base: number; // subtotal - deduction (taxable base)
  taxCode: string; // "PPN" | "PB1"
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  penaltyRate: number; // monthly
  penaltyMonths: number;
  penaltyAmount: number;
  total: number; // base + tax + penalty
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute an invoice's financials, config-driven per project:
 *  - Tax is PPN (11%) or PB1 (10%) depending on the project's tax config,
 *    applied to the taxable base (subtotal − deduction).
 *  - Penalty is the project's monthly rate applied per started month the invoice
 *    is overdue beyond its grace window, on the base amount.
 *  - Total = base + tax + penalty.
 * No project-named branches — all rates come from getTaxConfig / getPenaltyConfig
 * keyed by project code.
 */
export function computeInvoice(input: InvoiceCalcInput): InvoiceCalc {
  const subtotal = input.subtotal;
  const deduction = input.deduction ?? 0;
  const base = Math.max(0, subtotal - deduction);

  const tax = getTaxConfig(input.projectCode);
  const taxAmount = round2(base * tax.rate);

  const penalty = getPenaltyConfig(input.projectCode);
  const overdueDays = Math.max(0, input.overdueDays ?? 0);
  const chargeableDays = Math.max(0, overdueDays - penalty.graceDays);
  const penaltyMonths = chargeableDays > 0 ? Math.ceil(chargeableDays / 30) : 0;
  const penaltyAmount = round2(base * penalty.monthlyRate * penaltyMonths);

  return {
    subtotal: round2(subtotal),
    deduction: round2(deduction),
    base: round2(base),
    taxCode: tax.code,
    taxLabel: tax.label,
    taxRate: tax.rate,
    taxAmount,
    penaltyRate: penalty.monthlyRate,
    penaltyMonths,
    penaltyAmount,
    total: round2(base + taxAmount + penaltyAmount),
  };
}
