/**
 * Invoice type profiles — config-driven, keyed by a generic type code (no
 * project-named entries). Each profile shapes how the raw financial inputs are
 * derived for that kind of invoice: the deduction as a fraction of the subtotal
 * and whether a BBM (fuel) surcharge participates. The actual tax/penalty rates
 * still come from the per-project tax/penalty/BBM config via `computeInvoice`;
 * this only describes the shape of a given invoice *type*, so it stays reusable
 * across every project.
 */
export type InvoiceTypeProfile = {
  key: string;
  label: string;
  /** Default deduction (e.g. backcharge) as a fraction of the subtotal. */
  deductionRate: number;
  /** Whether this invoice type carries a BBM (fuel) surcharge line. */
  hasBbm: boolean;
  /** BBM surcharge as a fraction of the subtotal (only used when hasBbm). */
  bbmRate: number;
};

const INVOICE_TYPES: InvoiceTypeProfile[] = [
  { key: "meals", label: "Jasa Katering (Meals)", deductionRate: 0.02, hasBbm: false, bbmRate: 0 },
  { key: "meals_bbm", label: "Katering + BBM", deductionRate: 0.02, hasBbm: true, bbmRate: 0.06 },
  { key: "backcharge", label: "Dengan Backcharge", deductionRate: 0.12, hasBbm: false, bbmRate: 0 },
  { key: "full", label: "Kontrak Penuh", deductionRate: 0.04, hasBbm: true, bbmRate: 0.04 },
];

/** All configured invoice types. */
export function listInvoiceTypes(): InvoiceTypeProfile[] {
  return INVOICE_TYPES;
}

/** Whether a type key is configured. */
export function isInvoiceType(key: string): boolean {
  return INVOICE_TYPES.some((t) => t.key === key);
}

/** Resolve a type profile by key, falling back to the first (default) type. */
export function getInvoiceType(key: string): InvoiceTypeProfile {
  return INVOICE_TYPES.find((t) => t.key === key) ?? INVOICE_TYPES[0];
}
