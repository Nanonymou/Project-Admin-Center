import { addInvoiceActivity } from "@/db/repositories/invoice-activity-repository";
import type { Invoice, InvoiceActivity, NewInvoiceActivity } from "@/db/schema";

/**
 * Invoice audit-trail recorder. Centralizes writing to the append-only
 * invoice_activities table so every invoice write path (create, edit, stage
 * transition, document upload, send, comment) records its event identically,
 * tenant-scoped from the invoice itself. Keeping this in one service — rather
 * than inlining inserts in each route — means the audit trail can never drift in
 * shape between endpoints.
 */

export type InvoiceAction = NewInvoiceActivity["action"];

export type RecordActivityInput = {
  invoice: Pick<Invoice, "id" | "projectId" | "locationId">;
  action: InvoiceAction;
  actor: string;
  role?: string;
  fromStage?: string | null;
  toStage?: string | null;
  detail?: string;
  /** Structured context (e.g. changed fields with before/after values). */
  metadata?: unknown;
  /** Request provenance for the audit record. */
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Append one audit-trail entry for an invoice. Best-effort by contract: the
 * caller decides whether a DB failure should propagate (audit logging should not
 * usually fail the primary write), so wrap the call in try/catch when the primary
 * operation must succeed regardless.
 */
export async function recordInvoiceActivity(input: RecordActivityInput): Promise<InvoiceActivity> {
  return addInvoiceActivity({
    invoiceId: input.invoice.id,
    projectId: input.invoice.projectId,
    locationId: input.invoice.locationId,
    action: input.action,
    actor: input.actor,
    role: input.role,
    fromStage: input.fromStage ?? undefined,
    toStage: input.toStage ?? undefined,
    detail: input.detail,
    metadata: input.metadata ?? undefined,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

/** Record invoice creation. */
export function recordInvoiceCreated(
  invoice: RecordActivityInput["invoice"] & { number?: string },
  actor: string,
  role?: string,
): Promise<InvoiceActivity> {
  return recordInvoiceActivity({
    invoice,
    action: "create",
    actor,
    role,
    detail: invoice.number ? `Invoice ${invoice.number} dibuat.` : "Invoice dibuat.",
  });
}

/** Record an invoice edit, optionally naming the fields that changed. */
export function recordInvoiceEdited(
  invoice: RecordActivityInput["invoice"],
  actor: string,
  fields: string[] = [],
  role?: string,
): Promise<InvoiceActivity> {
  const detail =
    fields.length > 0 ? `Perubahan pada: ${fields.join(", ")}.` : "Invoice diperbarui.";
  return recordInvoiceActivity({ invoice, action: "edit", actor, role, detail });
}

export type InvoiceFieldChange = { field: string; before: unknown; after: unknown };

/** Invoice fields whose changes are worth auditing. */
const AUDITED_FIELDS: (keyof Invoice)[] = [
  "number",
  "subtotal",
  "deduction",
  "base",
  "bbmAmount",
  "taxableBase",
  "tax",
  "penaltyAmount",
  "amount",
  "status",
  "stage",
  "agingBucket",
  "issuedDate",
  "dueDate",
  "pic",
];

/**
 * Diff two invoice snapshots over the audited fields. A value is "changed" when
 * its stringified form differs (numeric columns are strings from Drizzle, so this
 * compares them correctly). `exclude` skips fields already recorded elsewhere
 * (e.g. a stage move logged as its own event).
 */
export function diffInvoice(
  before: Invoice,
  after: Invoice,
  exclude: (keyof Invoice)[] = [],
): InvoiceFieldChange[] {
  const skip = new Set(exclude);
  const changes: InvoiceFieldChange[] = [];
  for (const f of AUDITED_FIELDS) {
    if (skip.has(f)) continue;
    const b = before[f];
    const a = after[f];
    if (String(b ?? "") !== String(a ?? "")) {
      changes.push({ field: f as string, before: b ?? null, after: a ?? null });
    }
  }
  return changes;
}

/**
 * Automatic invoice change recorder — diffs the before/after snapshots and, when
 * anything audited changed, writes a single "edit" activity carrying the
 * field-level changes (before → after) in the audit metadata. Returns the
 * activity, or null when nothing audited changed. This is the service the write
 * routes call so every invoice mutation is logged consistently without each
 * route re-implementing the diff.
 */
export async function recordInvoiceChanges(
  before: Invoice,
  after: Invoice,
  actor: string,
  opts: { role?: string; exclude?: (keyof Invoice)[]; ipAddress?: string; userAgent?: string } = {},
): Promise<InvoiceActivity | null> {
  const changes = diffInvoice(before, after, opts.exclude);
  if (changes.length === 0) return null;
  return recordInvoiceActivity({
    invoice: after,
    action: "edit",
    actor,
    role: opts.role,
    detail: `Perubahan pada: ${changes.map((c) => c.field).join(", ")}.`,
    metadata: { changes },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}

/** Record a stage transition (approval workflow movement). */
export function recordStageTransition(
  invoice: RecordActivityInput["invoice"],
  actor: string,
  fromStage: string | null,
  toStage: string,
  role?: string,
): Promise<InvoiceActivity> {
  return recordInvoiceActivity({
    invoice,
    action: "review",
    actor,
    role,
    fromStage,
    toStage,
    detail: `Tahap: ${fromStage ?? "-"} → ${toStage}.`,
  });
}

/** Record a document upload against the invoice. */
export function recordDocumentUpload(
  invoice: RecordActivityInput["invoice"],
  actor: string,
  fileName: string,
  role?: string,
): Promise<InvoiceActivity> {
  return recordInvoiceActivity({
    invoice,
    action: "upload",
    actor,
    role,
    detail: `Dokumen diunggah: ${fileName}.`,
  });
}
