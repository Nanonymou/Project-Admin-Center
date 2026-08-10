import { parseCsv } from "@/lib/csv";

/**
 * Reusable import validation & duplicate-detection service. Parses an
 * Excel-as-CSV payload, validates the header and each data row against a column
 * spec, and flags rows that duplicate a composite key within the file. Shared by
 * the import parse (dry-run) and commit endpoints so both apply identical rules.
 */

/** Per-column validator: returns an error message for the cell, or null if ok. */
export type ColumnValidator = (value: string, row: string[]) => string | null;

export type ImportColumnSpec = {
  /** Column header names in order (case-insensitive match). */
  columns: readonly string[];
  /** Validators aligned to `columns` by index (a missing entry = no check). */
  validators: ColumnValidator[];
  /** Column indices forming the duplicate key (defaults to all columns). */
  keyColumns?: number[];
};

export type ImportValidatedRow = {
  row: number; // 1-based file row (accounts for header)
  cells: string[];
  valid: boolean;
  duplicate: boolean;
  issues: string[];
};

export type ImportValidationResult = {
  headerOk: boolean;
  header: string[];
  total: number;
  valid: number;
  invalid: number;
  duplicateCount: number;
  rows: ImportValidatedRow[];
};

/** True when the header matches the expected columns (order-sensitive). */
export function isHeaderValid(header: string[], columns: readonly string[]): boolean {
  return (
    header.length >= columns.length &&
    columns.every((c, i) => (header[i] ?? "").trim().toLowerCase() === c.toLowerCase())
  );
}

/**
 * Validate an import CSV. Returns null when the file has no data rows so the
 * caller can respond with a 422; otherwise returns the full validation result.
 */
export function validateImport(csv: string, spec: ImportColumnSpec): ImportValidationResult | null {
  const rows = parseCsv(csv).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return null;

  const header = rows[0].map((h) => h.trim());
  const headerOk = isHeaderValid(header, spec.columns);
  const keyCols = spec.keyColumns ?? spec.columns.map((_, i) => i);

  const seen = new Set<string>();
  const data = rows.slice(1);
  const validatedRows: ImportValidatedRow[] = data.map((cells, i) => {
    const issues: string[] = [];
    spec.validators.forEach((fn, ci) => {
      const issue = fn((cells[ci] ?? "").trim(), cells);
      if (issue) issues.push(issue);
    });
    const key = keyCols.map((ci) => (cells[ci] ?? "").trim().toLowerCase()).join("|");
    const duplicate = seen.has(key);
    if (duplicate) issues.push("Baris duplikat (kunci sama dengan baris sebelumnya).");
    else seen.add(key);
    return { row: i + 2, cells, valid: issues.length === 0, duplicate, issues };
  });

  const valid = validatedRows.filter((r) => r.valid).length;
  const duplicateCount = validatedRows.filter((r) => r.duplicate).length;
  return {
    headerOk,
    header,
    total: validatedRows.length,
    valid,
    invalid: validatedRows.length - valid,
    duplicateCount,
    rows: validatedRows,
  };
}

/** Column spec for a Daily Sales import file. */
export const DAILY_SALES_IMPORT_SPEC: ImportColumnSpec = {
  columns: ["trxDate", "categoryKey", "qty", "price"],
  validators: [
    (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Tanggal tidak valid (YYYY-MM-DD)."),
    (v) => (v ? null : "categoryKey kosong."),
    (v) => (Number(v) > 0 ? null : "qty harus > 0."),
    (v) => (v === "" || Number(v) >= 0 ? null : "price tidak valid."),
  ],
  keyColumns: [0, 1], // trxDate + categoryKey
};
