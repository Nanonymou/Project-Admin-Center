import { getTaxConfig } from "@/lib/mock/tax-config";
import { getPenaltyConfig } from "@/lib/mock/penalty-config";
import { getBbmConfig } from "@/lib/mock/bbm-config";

/**
 * Formula Engine built-in parameters (config-derived). The engine's default calc
 * inputs for a project come from the tax / penalty / BBM configs; the Formula
 * Engine layers DB overrides and custom parameters on top. This module exposes
 * those defaults in the unified parameter shape the API and UI consume, so the
 * "effective parameter" is simply override-if-present-else this default.
 */

export type FormulaParamType = "percent" | "days" | "flag" | "flat";

export type FormulaParam = {
  key: string;
  label: string;
  group: string;
  type: FormulaParamType;
  /** Numeric value; flags are 0/1, percents are fractions (0.11 = 11%). */
  value: number;
  builtin: boolean;
};

/** The built-in parameters for a project, derived from its config. */
export function getBuiltinFormulaParams(projectCode: string): FormulaParam[] {
  const tax = getTaxConfig(projectCode);
  const penalty = getPenaltyConfig(projectCode);
  const bbm = getBbmConfig(projectCode);

  return [
    { key: "tax_rate", label: `Pajak (${tax.label})`, group: "Pajak", type: "percent", value: tax.rate, builtin: true },
    { key: "penalty_monthly_rate", label: "Denda per Bulan", group: "Denda", type: "percent", value: penalty.monthlyRate, builtin: true },
    { key: "penalty_grace_days", label: "Masa Tenggang Denda", group: "Denda", type: "days", value: penalty.graceDays, builtin: true },
    { key: "bbm_applies", label: "BBM Berlaku", group: "BBM", type: "flag", value: bbm.applies ? 1 : 0, builtin: true },
    { key: "bbm_taxable", label: "BBM Kena Pajak", group: "BBM", type: "flag", value: bbm.taxable ? 1 : 0, builtin: true },
  ];
}

export function getBuiltinFormulaParam(projectCode: string, key: string): FormulaParam | undefined {
  return getBuiltinFormulaParams(projectCode).find((p) => p.key === key);
}
