import { listFormulaParameters } from "@/db/repositories/formula-parameter-repository";
import type { FormulaOverrides } from "@/lib/server/services/invoice-calculation-service";

/**
 * Resolve the effective Formula Engine overrides for a project from the
 * formula_parameters table, mapping the stored parameter keys onto the calc
 * function's override shape. Only ACTIVE overrides participate — a deactivated
 * parameter reverts to the config default. Server-only (touches the DB); on any
 * DB error it returns an empty override set so the calculation falls back to the
 * config defaults and never fails because the pricing engine is unreachable.
 */
export async function resolveFormulaOverrides(projectCode: string): Promise<FormulaOverrides> {
  try {
    const rows = await listFormulaParameters(projectCode, true);
    const byKey = new Map(rows.map((r) => [r.key, Number(r.value)]));
    const overrides: FormulaOverrides = {};

    if (byKey.has("tax_rate")) overrides.taxRate = byKey.get("tax_rate");
    if (byKey.has("penalty_monthly_rate")) overrides.penaltyMonthlyRate = byKey.get("penalty_monthly_rate");
    if (byKey.has("penalty_grace_days")) overrides.penaltyGraceDays = byKey.get("penalty_grace_days");
    if (byKey.has("bbm_applies")) overrides.bbmApplies = byKey.get("bbm_applies") === 1;
    if (byKey.has("bbm_taxable")) overrides.bbmTaxable = byKey.get("bbm_taxable") === 1;

    return overrides;
  } catch {
    return {};
  }
}
