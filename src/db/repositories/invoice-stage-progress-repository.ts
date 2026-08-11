import { and, asc, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  invoiceStageProgress,
  type InvoiceStageProgress,
  type NewInvoiceStageProgress,
} from "@/db/schema";

export type StageProgressFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  invoiceId?: string;
  breached?: boolean;
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: StageProgressFilter): SQL | undefined {
  const conds: SQL[] = [isNull(invoiceStageProgress.deletedAt)];
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped stage-progress queries");
    }
    conds.push(eq(invoiceStageProgress.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(invoiceStageProgress.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(invoiceStageProgress.locationId, filter.locationId));
  if (filter.invoiceId) conds.push(eq(invoiceStageProgress.invoiceId, filter.invoiceId));
  if (filter.breached !== undefined) conds.push(eq(invoiceStageProgress.breached, filter.breached));
  return and(...conds);
}

/** An invoice's stage-progress rows in stage order (the processing timeline). */
export async function listStageProgressForInvoice(
  invoiceId: string,
): Promise<InvoiceStageProgress[]> {
  return db
    .select()
    .from(invoiceStageProgress)
    .where(and(eq(invoiceStageProgress.invoiceId, invoiceId), isNull(invoiceStageProgress.deletedAt)))
    .orderBy(asc(invoiceStageProgress.stageOrder));
}

/**
 * Stage-progress rows across the filtered scope (per site/project), newest first.
 * Tenant-scoped: a tenant query requires a projectId. Repository Pattern: all DB
 * access to the stage-progress table flows through this module.
 */
export async function listStageProgress(
  filter: StageProgressFilter,
): Promise<InvoiceStageProgress[]> {
  return db
    .select()
    .from(invoiceStageProgress)
    .where(buildWhere(filter))
    .orderBy(desc(invoiceStageProgress.updatedAt));
}

/**
 * Upsert one stage-progress row (unique per invoice + stage). Used to record a
 * stage's timing/state as an invoice moves through the flow.
 */
export async function upsertStageProgress(
  values: NewInvoiceStageProgress,
): Promise<InvoiceStageProgress> {
  const [row] = await db
    .insert(invoiceStageProgress)
    .values(values)
    .onConflictDoUpdate({
      target: [invoiceStageProgress.invoiceId, invoiceStageProgress.stage],
      set: {
        stageOrder: values.stageOrder,
        slaDays: values.slaDays,
        state: values.state,
        startedAt: values.startedAt,
        completedAt: values.completedAt,
        actualDays: values.actualDays,
        breached: values.breached,
        pic: values.pic,
        docCount: values.docCount,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
