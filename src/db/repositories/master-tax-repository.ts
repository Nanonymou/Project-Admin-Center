import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterTaxes, type MasterTaxRow, type NewMasterTaxRow } from "@/db/schema";

/**
 * Master Tax Engine data access. Repository Pattern: all DB access to
 * master_taxes flows through this module. Profiles are keyed by project_code; a
 * null project_code is the shared global default.
 */

export async function listMasterTaxes(activeOnly = false): Promise<MasterTaxRow[]> {
  const rows = await db.select().from(masterTaxes).orderBy(asc(masterTaxes.projectCode));
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

export async function getMasterTax(projectCode: string | null): Promise<MasterTaxRow | undefined> {
  const cond: SQL = projectCode === null ? isNull(masterTaxes.projectCode) : eq(masterTaxes.projectCode, projectCode);
  const [row] = await db.select().from(masterTaxes).where(cond).limit(1);
  return row;
}

/**
 * Upsert a tax profile for a project (or the global default when projectCode is
 * null). Since Postgres treats NULLs as distinct in a unique index, the null-
 * project case is handled explicitly (update if present, else insert).
 */
export async function upsertMasterTax(values: NewMasterTaxRow): Promise<void> {
  const projectCode = values.projectCode ?? null;
  const existing = await getMasterTax(projectCode);
  if (existing) {
    await db
      .update(masterTaxes)
      .set({
        code: values.code,
        label: values.label,
        rate: values.rate,
        active: values.active ?? true,
        updatedAt: new Date(),
      })
      .where(eq(masterTaxes.id, existing.id));
    return;
  }
  await db.insert(masterTaxes).values(values);
}

/** Activate/deactivate a tax profile by project (null = global). Returns false if absent. */
export async function setMasterTaxActive(projectCode: string | null, active: boolean): Promise<boolean> {
  const existing = await getMasterTax(projectCode);
  if (!existing) return false;
  await db.update(masterTaxes).set({ active, updatedAt: new Date() }).where(eq(masterTaxes.id, existing.id));
  return true;
}

/**
 * Permanently delete a tax profile by project (null = global). Returns false when
 * the profile does not exist. Callers must first confirm the profile is not in
 * use (see the delete-protection guard in the API); this does no such check.
 */
export async function deleteMasterTax(projectCode: string | null): Promise<boolean> {
  const existing = await getMasterTax(projectCode);
  if (!existing) return false;
  await db.delete(masterTaxes).where(eq(masterTaxes.id, existing.id));
  return true;
}
