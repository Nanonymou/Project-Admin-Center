import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  formulaParameters,
  formulaParameterHistory,
  type FormulaParameterRow,
  type NewFormulaParameterRow,
  type FormulaParameterHistoryRow,
  type NewFormulaParameterHistoryRow,
} from "@/db/schema";

/**
 * Formula Engine parameter data access. Repository Pattern: all DB access to
 * formula_parameters / formula_parameter_history flows through this module.
 */

export async function listFormulaParameters(
  projectCode: string,
  activeOnly = false,
): Promise<FormulaParameterRow[]> {
  const conds: SQL[] = [eq(formulaParameters.projectCode, projectCode)];
  if (activeOnly) conds.push(eq(formulaParameters.active, true));
  return db
    .select()
    .from(formulaParameters)
    .where(and(...conds))
    .orderBy(asc(formulaParameters.group), asc(formulaParameters.key));
}

export async function getFormulaParameter(
  projectCode: string,
  key: string,
): Promise<FormulaParameterRow | undefined> {
  const [row] = await db
    .select()
    .from(formulaParameters)
    .where(and(eq(formulaParameters.projectCode, projectCode), eq(formulaParameters.key, key)))
    .limit(1);
  return row;
}

/** Upsert a formula parameter by (projectCode, key). */
export async function upsertFormulaParameter(values: NewFormulaParameterRow): Promise<void> {
  await db
    .insert(formulaParameters)
    .values(values)
    .onConflictDoUpdate({
      target: [formulaParameters.projectCode, formulaParameters.key],
      set: {
        label: values.label,
        group: values.group,
        type: values.type,
        value: values.value,
        active: values.active ?? true,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate a formula parameter. Returns false when it does not exist. */
export async function setFormulaParameterActive(
  projectCode: string,
  key: string,
  active: boolean,
): Promise<boolean> {
  const existing = await getFormulaParameter(projectCode, key);
  if (!existing) return false;
  await db
    .update(formulaParameters)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(formulaParameters.projectCode, projectCode), eq(formulaParameters.key, key)));
  return true;
}

/** Append a non-destructive change-history entry. */
export async function recordFormulaParameterChange(
  entry: NewFormulaParameterHistoryRow,
): Promise<void> {
  await db.insert(formulaParameterHistory).values(entry);
}

/** Change history for a project (optionally one parameter), newest first. */
export async function listFormulaParameterHistory(
  projectCode: string,
  key?: string,
): Promise<FormulaParameterHistoryRow[]> {
  const conds: SQL[] = [eq(formulaParameterHistory.projectCode, projectCode)];
  if (key) conds.push(eq(formulaParameterHistory.key, key));
  return db
    .select()
    .from(formulaParameterHistory)
    .where(and(...conds))
    .orderBy(desc(formulaParameterHistory.createdAt));
}
