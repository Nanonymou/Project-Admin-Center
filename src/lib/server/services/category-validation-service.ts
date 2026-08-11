/**
 * Master category validation (shared, server-side). Centralizes the rules the
 * category CRUD endpoints apply so validation stays consistent and testable —
 * used by POST /api/master/categories and any importer. Pure & DB-free.
 */

export type CategoryInput = {
  kind: unknown;
  categoryKey: unknown;
  label: unknown;
  defaultPrice?: unknown;
  unit?: unknown;
};

export type CategoryValidationError = { field: string; message: string };

const KEY_RE = /^[a-z0-9_]+$/;

/**
 * Validate a master category input. Returns a list of field errors (empty when
 * valid). Rules: kind ∈ {sales,cost}; category_key non-empty & slug-safe; label
 * non-empty; default_price a finite number ≥ 0 when provided.
 */
export function validateCategoryInput(input: CategoryInput): CategoryValidationError[] {
  const errors: CategoryValidationError[] = [];

  if (input.kind !== "sales" && input.kind !== "cost") {
    errors.push({ field: "kind", message: "kind harus 'sales' atau 'cost'." });
  }

  const key = typeof input.categoryKey === "string" ? input.categoryKey.trim() : "";
  if (!key) {
    errors.push({ field: "categoryKey", message: "categoryKey wajib diisi." });
  } else if (!KEY_RE.test(key)) {
    errors.push({ field: "categoryKey", message: "categoryKey hanya boleh huruf kecil, angka, dan underscore." });
  }

  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label) {
    errors.push({ field: "label", message: "label wajib diisi." });
  }

  if (input.defaultPrice !== undefined && input.defaultPrice !== null && input.defaultPrice !== "") {
    const price = Number(input.defaultPrice);
    if (Number.isNaN(price) || !Number.isFinite(price) || price < 0) {
      errors.push({ field: "defaultPrice", message: "defaultPrice harus angka ≥ 0." });
    }
  }

  return errors;
}
