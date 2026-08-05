/**
 * Config-driven Daily Cost categories per project — PRD Appendix §16.C
 * (Daily Cost Matrix). Keyed by project code so availability is data, not
 * hardcoded conditionals. A new project only needs a row here (or a DB row).
 */
export type CostCategory = {
  key: string;
  label: string;
  hint?: string;
  /** Whether an attachment is expected for this category. */
  requiresProof?: boolean;
};

const ALL_CATEGORIES: Record<string, CostCategory> = {
  food_meals: { key: "food_meals", label: "Food Cost Meals", requiresProof: true },
  food_hkl: { key: "food_hkl", label: "Food Cost HKL/Laundry", requiresProof: true },
  food_backcharge: { key: "food_backcharge", label: "Food Cost Backcharge" },
  cash_advance: { key: "cash_advance", label: "Cash Advance", requiresProof: true },
  petty_cash: { key: "petty_cash", label: "Dana Cash (Petty Cash)", hint: "Khusus PHSS" },
  voucher: { key: "voucher", label: "Voucher Operasional" },
};

const PROJECT_COST_KEYS: Record<string, string[]> = {
  BUMA: ["food_meals", "food_hkl", "food_backcharge", "cash_advance", "voucher"],
  POMALA: ["food_meals", "food_hkl", "food_backcharge", "cash_advance", "voucher"],
  PHSS: ["food_meals", "food_backcharge", "cash_advance", "petty_cash", "voucher"],
  PHKT: ["food_meals", "food_backcharge", "cash_advance", "voucher"],
};

export function getCostCategories(projectCode: string): CostCategory[] {
  const keys = PROJECT_COST_KEYS[projectCode] ?? PROJECT_COST_KEYS.BUMA;
  return keys.map((k) => ALL_CATEGORIES[k]);
}

export type CostEntryInput = Record<string, number>;

export type CostValidationError = {
  key: string;
  message: string;
};

/**
 * Dynamic validation (Zod-style, hand-rolled): every category value must be
 * a non-negative finite number, and at least one category must be > 0.
 */
export function validateCostEntry(
  categories: CostCategory[],
  values: CostEntryInput,
): CostValidationError[] {
  const errors: CostValidationError[] = [];
  let hasPositive = false;
  for (const cat of categories) {
    const raw = values[cat.key];
    if (raw === undefined || Number.isNaN(raw)) {
      // empty is treated as 0, not an error
      continue;
    }
    if (raw < 0) {
      errors.push({ key: cat.key, message: `${cat.label} tidak boleh negatif.` });
    }
    if (!Number.isFinite(raw)) {
      errors.push({ key: cat.key, message: `${cat.label} bukan angka valid.` });
    }
    if (raw > 0) hasPositive = true;
  }
  if (!hasPositive) {
    errors.push({ key: "_form", message: "Minimal satu kategori cost harus diisi." });
  }
  return errors;
}

export function sumCostEntry(categories: CostCategory[], values: CostEntryInput): number {
  return categories.reduce((sum, cat) => sum + (values[cat.key] || 0), 0);
}
