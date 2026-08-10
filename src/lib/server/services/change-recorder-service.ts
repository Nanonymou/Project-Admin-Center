import {
  recordEntryChange,
  listEntryChangeHistory,
} from "@/db/repositories/entry-change-history-repository";
import type { EntryChangeHistory } from "@/db/schema";

/**
 * Change-recorder service. Computes field-level diffs between a transaction's
 * before/after snapshots and persists them to the generic entry change history,
 * so an update records exactly what changed (field, before → after). Shared by
 * the sales and cost update flows via `kind`, keeping recording logic in one
 * place instead of duplicated in each endpoint.
 */

export type FieldDiff = { field: string; before: number | null; after: number | null };

/**
 * Compare two numeric field maps and return the entries that changed. Fields
 * absent from `after` are ignored; a value moving to/from null is a change.
 */
export function computeNumericDiffs(
  before: Record<string, number | null | undefined>,
  after: Record<string, number | null | undefined>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of Object.keys(after)) {
    const b = before[field] ?? null;
    const a = after[field] ?? null;
    if (Number(b) !== Number(a)) diffs.push({ field, before: b, after: a });
  }
  return diffs;
}

export type RecordChangeInput = {
  projectId: string;
  locationId: string;
  kind: "sales" | "cost";
  transactionId?: string;
  trxDate: string;
  categoryKey?: string;
  editor: string;
  reason?: string;
};

/**
 * Record a transaction update as one entry-change-history row per changed field.
 * Returns the number of rows written (0 when nothing changed). Best-effort: the
 * caller decides whether a DB error should propagate.
 */
export async function recordTransactionUpdate(
  input: RecordChangeInput,
  diffs: FieldDiff[],
): Promise<number> {
  if (diffs.length === 0) return 0;
  for (const d of diffs) {
    await recordEntryChange({
      projectId: input.projectId,
      locationId: input.locationId,
      kind: input.kind,
      transactionId: input.transactionId ?? null,
      trxDate: input.trxDate,
      categoryKey: input.categoryKey ?? null,
      action: "update",
      field: d.field,
      beforeValue: d.before !== null ? d.before.toFixed(2) : null,
      afterValue: d.after !== null ? d.after.toFixed(2) : null,
      editor: input.editor,
      reason: input.reason,
    });
  }
  return diffs.length;
}

/** Record a transaction creation (single "create" row for its total). */
export async function recordTransactionCreate(
  input: RecordChangeInput,
  total: number,
): Promise<void> {
  await recordEntryChange({
    projectId: input.projectId,
    locationId: input.locationId,
    kind: input.kind,
    transactionId: input.transactionId ?? null,
    trxDate: input.trxDate,
    categoryKey: input.categoryKey ?? null,
    action: "create",
    field: "total",
    beforeValue: null,
    afterValue: total.toFixed(2),
    editor: input.editor,
    reason: input.reason ?? "Entri baru dibuat.",
  });
}

/** Fetch a transaction's recorded change history (newest first). */
export async function getTransactionChangeHistory(
  transactionId: string,
): Promise<EntryChangeHistory[]> {
  return listEntryChangeHistory({ transactionId, scope: "executive" });
}
