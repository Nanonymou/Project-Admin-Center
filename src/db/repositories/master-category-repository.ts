import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterCategories, type MasterCategory, type NewMasterCategory } from "@/db/schema";

export type MasterCategoryFilter = {
  projectCode: string;
  kind?: "sales" | "cost";
  activeOnly?: boolean;
};

/**
 * List master categories (meal/service or cost types with default prices) for a
 * project, optionally narrowed by kind. Repository Pattern: all DB access to the
 * master_categories table flows through this module.
 */
export async function listMasterCategories(
  filter: MasterCategoryFilter,
): Promise<MasterCategory[]> {
  const conds: SQL[] = [eq(masterCategories.projectCode, filter.projectCode)];
  if (filter.kind) conds.push(eq(masterCategories.kind, filter.kind));
  if (filter.activeOnly) conds.push(eq(masterCategories.active, true));
  return db
    .select()
    .from(masterCategories)
    .where(and(...conds))
    .orderBy(asc(masterCategories.kind), asc(masterCategories.categoryKey));
}

/** Upsert a master category by (projectCode, kind, categoryKey). */
export async function upsertMasterCategory(values: NewMasterCategory): Promise<void> {
  await db
    .insert(masterCategories)
    .values(values)
    .onConflictDoUpdate({
      target: [masterCategories.projectCode, masterCategories.kind, masterCategories.categoryKey],
      set: {
        label: values.label,
        subCategory: values.subCategory,
        unit: values.unit,
        defaultPrice: values.defaultPrice,
        isDeduction: values.isDeduction,
        active: true,
        updatedAt: new Date(),
      },
    });
}
