/**
 * Config-driven Service Category matrix — PRD Appendix §16.B. Which sales
 * service categories are active is keyed by project code, so the Daily
 * Sales engine is generic: a new project only needs a row here (or a DB
 * row). No `if (project === 'PHSS')` anywhere.
 */
export type ServiceCategory = {
  key: string;
  label: string;
  unit: string;
  /** Default unit price used to prefill the price column (Rupiah). */
  defaultPrice: number;
  /** When true this line reduces the daily total (e.g. Backcharge). */
  deduction?: boolean;
};

const ALL_SERVICES: Record<string, ServiceCategory> = {
  meals_buffet: { key: "meals_buffet", label: "Meals Buffet", unit: "porsi", defaultPrice: 45000 },
  meals_packmeal: { key: "meals_packmeal", label: "Meals Packmeal", unit: "pack", defaultPrice: 38000 },
  housekeeping: { key: "housekeeping", label: "Housekeeping", unit: "room", defaultPrice: 60000 },
  laundry: { key: "laundry", label: "Laundry", unit: "kg", defaultPrice: 12000 },
  hkl: { key: "hkl", label: "HKL", unit: "unit", defaultPrice: 50000 },
  snack_box: { key: "snack_box", label: "Snack Box", unit: "box", defaultPrice: 15000 },
  air_minum: { key: "air_minum", label: "Air Minum", unit: "galon", defaultPrice: 18000 },
  extra_issue: { key: "extra_issue", label: "Extra Issue", unit: "item", defaultPrice: 25000 },
  room_service: { key: "room_service", label: "Room Service", unit: "room", defaultPrice: 75000 },
  camp_cleaning: { key: "camp_cleaning", label: "Camp Cleaning", unit: "area", defaultPrice: 90000 },
  ground_maintenance: { key: "ground_maintenance", label: "Ground Maintenance", unit: "area", defaultPrice: 85000 },
  accommodation: { key: "accommodation", label: "Accommodation", unit: "pax", defaultPrice: 120000 },
  backcharge: { key: "backcharge", label: "Backcharge", unit: "item", defaultPrice: 30000, deduction: true },
};

const PROJECT_SERVICE_KEYS: Record<string, string[]> = {
  BUMA: ["meals_buffet", "meals_packmeal", "housekeeping", "laundry", "backcharge"],
  POMALA: ["meals_buffet", "meals_packmeal", "hkl", "snack_box", "air_minum", "extra_issue", "backcharge"],
  PHSS: ["meals_buffet", "meals_packmeal", "room_service", "camp_cleaning", "ground_maintenance", "backcharge"],
  PHKT: ["meals_buffet", "meals_packmeal", "accommodation", "backcharge"],
};

export function getServiceCategories(projectCode: string): ServiceCategory[] {
  const keys = PROJECT_SERVICE_KEYS[projectCode] ?? PROJECT_SERVICE_KEYS.BUMA;
  return keys.map((k) => ALL_SERVICES[k]);
}

export type SalesLineInput = { qty: number; price: number };
export type SalesEntryInput = Record<string, SalesLineInput>;

export type SalesValidationError = { key: string; message: string };

/**
 * Dynamic validation (Zod-style, hand-rolled): qty and price must be
 * non-negative finite numbers; at least one line must have qty > 0.
 */
export function validateSalesEntry(
  categories: ServiceCategory[],
  values: SalesEntryInput,
): SalesValidationError[] {
  const errors: SalesValidationError[] = [];
  let hasQty = false;
  for (const cat of categories) {
    const line = values[cat.key];
    if (!line) continue;
    if (line.qty < 0 || !Number.isFinite(line.qty)) {
      errors.push({ key: cat.key, message: `Qty ${cat.label} tidak valid.` });
    }
    if (line.price < 0 || !Number.isFinite(line.price)) {
      errors.push({ key: cat.key, message: `Harga ${cat.label} tidak valid.` });
    }
    if (line.qty > 0) hasQty = true;
  }
  if (!hasQty) {
    errors.push({ key: "_form", message: "Minimal satu kategori sales harus memiliki Qty > 0." });
  }
  return errors;
}

export function lineTotal(line?: SalesLineInput): number {
  if (!line) return 0;
  return (line.qty || 0) * (line.price || 0);
}

/** Line total with sign applied — deduction categories are negative. */
export function signedLineTotal(cat: ServiceCategory, line?: SalesLineInput): number {
  const raw = lineTotal(line);
  return cat.deduction ? -raw : raw;
}

export type SalesBreakdown = {
  gross: number; // sum of non-deduction lines
  backcharge: number; // sum of deduction lines (positive magnitude)
  net: number; // gross - backcharge
};

/** Split the entry into gross sales, backcharge (deductions), and net total. */
export function sumSalesBreakdown(
  categories: ServiceCategory[],
  values: SalesEntryInput,
): SalesBreakdown {
  let gross = 0;
  let backcharge = 0;
  for (const cat of categories) {
    const raw = lineTotal(values[cat.key]);
    if (cat.deduction) backcharge += raw;
    else gross += raw;
  }
  return { gross, backcharge, net: gross - backcharge };
}

/** Net daily total (gross sales minus deductions). */
export function sumSalesEntry(categories: ServiceCategory[], values: SalesEntryInput): number {
  return sumSalesBreakdown(categories, values).net;
}
