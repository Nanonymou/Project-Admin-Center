import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterCategories, type MasterCategory } from "@/db/schema";

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
