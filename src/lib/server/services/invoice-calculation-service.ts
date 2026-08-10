import { getTaxConfig } from "@/lib/mock/tax-config";
import { getPenaltyConfig } from "@/lib/mock/penalty-config";
import { getBbmConfig } from "@/lib/mock/bbm-config";
import { getInvoiceType, isInvoiceType } from "@/lib/mock/invoice-type-config";

export type InvoiceCalcInput = {
  projectCode: string;
  subtotal: number;
  /** Deductions (e.g. backcharge) that reduce the taxable base. */
  deduction?: number;
  /** BBM (fuel) surcharge amount; only applied when the project's config enables it. */
  bbm?: number;
  /** Days overdue; drives the late-payment penalty. */
  overdueDays?: number;
};

export type InvoiceCalc = {
  subtotal: number;
  deduction: number;
  base: number; // subtotal - deduction (service base)
  bbmAmount: number; // fuel surcharge applied
  taxableBase: number; // amount the tax rate is applied to
  taxCode: string; // "PPN" | "PB1"
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  penaltyRate: number; // monthly
  penaltyMonths: number;
  penaltyAmount: number;
  total: number; // base + bbm + tax + penalty
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fully-validated, defaults-resolved invoice calculation input. */
export type ResolvedInvoiceCalcInput = {
  projectCode: string;
  invoiceType: { key: string; label: string };
  subtotal: number;
  deduction: number;
  bbm: number;
  overdueDays: number;
  /** Whether the BBM surcharge is in effect (type carries one + project enables it). */
  bbmApplies: boolean;
};

export type InvoiceCalcParse =
  | { ok: true; value: ResolvedInvoiceCalcInput }
  | { ok: false; status: number; error: string };

/**
 * Validate and resolve a raw invoice-calculation request body into a clean,
 * typed input. Centralizes every numeric/type rule so the calculate and save
 * routes validate identically (no duplicated inline checks):
 *  - projectCode required (accepts `projectId` as an alias).
 *  - subtotal must be a finite number >= 0.
 *  - invoiceType (optional) must be a configured type; its profile supplies the
 *    default deduction (fraction of subtotal) and BBM surcharge when omitted.
 *  - deduction/bbm/overdueDays, when present, must be numeric; deduction may not
 *    exceed the subtotal.
 * Pure (mock-config only) so it stays importable from client bundles.
 */
export function parseInvoiceCalcInput(body: Record<string, unknown>): InvoiceCalcParse {
  const projectCode =
    typeof body.projectCode === "string"
      ? body.projectCode
      : typeof body.projectId === "string"
        ? body.projectId
        : "";
  if (!projectCode) return { ok: false, status: 400, error: "projectCode wajib diisi." };

  const subtotal = Number(body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { ok: false, status: 400, error: "subtotal wajib berupa angka >= 0." };
  }

  const typeKey = typeof body.invoiceType === "string" ? body.invoiceType : "";
  if (typeKey && !isInvoiceType(typeKey)) {
    return { ok: false, status: 400, error: `Jenis invoice tidak dikenal: ${typeKey}.` };
  }
  const profile = getInvoiceType(typeKey);

  const hasDeduction = body.deduction !== undefined && body.deduction !== null;
  const rawDeduction = Number(body.deduction);
  if (hasDeduction && !Number.isFinite(rawDeduction)) {
    return { ok: false, status: 400, error: "deduction harus berupa angka." };
  }
  const deduction = hasDeduction
    ? Math.max(0, rawDeduction)
    : Math.round(subtotal * profile.deductionRate);
  if (deduction > subtotal) {
    return { ok: false, status: 422, error: "deduction tidak boleh melebihi subtotal." };
  }

  const bbmApplies = profile.hasBbm && getBbmConfig(projectCode).applies;
  const hasBbm = body.bbm !== undefined && body.bbm !== null;
  const rawBbm = Number(body.bbm);
  if (hasBbm && !Number.isFinite(rawBbm)) {
    return { ok: false, status: 400, error: "bbm harus berupa angka." };
  }
  const bbm = hasBbm
    ? Math.max(0, rawBbm)
    : bbmApplies
      ? Math.round(subtotal * profile.bbmRate)
      : 0;

  const hasOverdue = body.overdueDays !== undefined && body.overdueDays !== null;
  const rawOverdue = Number(body.overdueDays);
  if (hasOverdue && (!Number.isFinite(rawOverdue) || rawOverdue < 0)) {
    return { ok: false, status: 400, error: "overdueDays harus berupa angka >= 0." };
  }
  const overdueDays = hasOverdue ? Math.max(0, Math.floor(rawOverdue)) : 0;

  return {
    ok: true,
    value: {
      projectCode,
      invoiceType: { key: profile.key, label: profile.label },
      subtotal,
      deduction,
      bbm,
      overdueDays,
      bbmApplies,
    },
  };
}

/**
 * Map a computed invoice to its persistable column values (numerics formatted as
 * strings the way Drizzle's `numeric` expects). `overdueDays` is a calc input —
 * not part of the result — so it is passed through to record what drove the
 * penalty. Shared by the save (POST) and update (PATCH) routes so the full
 * Formula Engine breakdown is persisted consistently. Returns plain column
 * values (no schema import), keeping this module client-importable.
 */
export function invoiceCalcColumns(calc: InvoiceCalc, overdueDays: number) {
  return {
    subtotal: calc.subtotal.toFixed(2),
    deduction: calc.deduction.toFixed(2),
    base: calc.base.toFixed(2),
    bbmAmount: calc.bbmAmount.toFixed(2),
    taxableBase: calc.taxableBase.toFixed(2),
    taxCode: calc.taxCode,
    taxRate: calc.taxRate.toFixed(4),
    tax: calc.taxAmount.toFixed(2),
    overdueDays: Math.max(0, Math.floor(overdueDays)),
    penaltyRate: calc.penaltyRate.toFixed(4),
    penaltyMonths: calc.penaltyMonths,
    penaltyAmount: calc.penaltyAmount.toFixed(2),
    amount: calc.total.toFixed(2),
  };
}

/**
 * Compute an invoice's financials, config-driven per project:
 *  - BBM (fuel) surcharge is added when the project's config enables it; it may
 *    be part of the taxable base per that config.
 *  - Tax is PPN (11%) or PB1 (10%) depending on the project's tax config,
 *    applied to the taxable base (service base + taxable BBM).
 *  - Penalty is the project's monthly rate applied per started month the invoice
 *    is overdue beyond its grace window, on the service base.
 *  - Total = base + bbm + tax + penalty.
 * No project-named branches — all rates come from getTaxConfig / getPenaltyConfig
 * / getBbmConfig keyed by project code.
 */
export function computeInvoice(input: InvoiceCalcInput): InvoiceCalc {
  const subtotal = input.subtotal;
  const deduction = input.deduction ?? 0;
  const base = Math.max(0, subtotal - deduction);

  const bbmCfg = getBbmConfig(input.projectCode);
  const bbmAmount = bbmCfg.applies ? Math.max(0, input.bbm ?? 0) : 0;
  const taxableBase = bbmCfg.taxable ? base + bbmAmount : base;

  const tax = getTaxConfig(input.projectCode);
  const taxAmount = round2(taxableBase * tax.rate);

  const penalty = getPenaltyConfig(input.projectCode);
  const overdueDays = Math.max(0, input.overdueDays ?? 0);
  const chargeableDays = Math.max(0, overdueDays - penalty.graceDays);
  const penaltyMonths = chargeableDays > 0 ? Math.ceil(chargeableDays / 30) : 0;
  const penaltyAmount = round2(base * penalty.monthlyRate * penaltyMonths);

  return {
    subtotal: round2(subtotal),
    deduction: round2(deduction),
    base: round2(base),
    bbmAmount: round2(bbmAmount),
    taxableBase: round2(taxableBase),
    taxCode: tax.code,
    taxLabel: tax.label,
    taxRate: tax.rate,
    taxAmount,
    penaltyRate: penalty.monthlyRate,
    penaltyMonths,
    penaltyAmount,
    total: round2(base + bbmAmount + taxAmount + penaltyAmount),
  };
}
