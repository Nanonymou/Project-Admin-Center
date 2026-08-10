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
