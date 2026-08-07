import { db } from "@/db";
import { masterCategories, type NewMasterCategory } from "@/db/schema";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";

export type MasterSeedResult = { projects: number; rows: number };

/** Distinct configured project codes, sourced from the workspace config. */
function projectCodes(): string[] {
  return Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));
}

/**
 * Derive a coarse sub-category grouping from a category key so the master list
 * carries "kategori dan subkategori". Config-agnostic: grouping is inferred from
 * the key prefix, not from project-specific rules.
 */
function subCategoryOf(key: string): string {
  if (key.startsWith("meals") || key.startsWith("food")) return "F&B";
  if (key === "backcharge" || key === "food_backcharge") return "Adjustment";
  if (key.includes("cash") || key === "voucher" || key === "petty_cash") return "Finance";
  return "Operational";
}

/**
 * Seed the master price list from the per-project service/cost configuration.
 * Idempotent: every (project, kind, category) is upserted, so re-running keeps a
 * single row per key and refreshes prices/labels. Reads prices from config keyed
 * by project code — no project-named branches.
 */
export async function seedMasterCategories(): Promise<MasterSeedResult> {
  const rows: NewMasterCategory[] = [];
  const codes = projectCodes();

  for (const projectCode of codes) {
    for (const cat of getServiceCategories(projectCode)) {
      rows.push({
        projectCode,
        kind: "sales",
        categoryKey: cat.key,
        label: cat.label,
        subCategory: subCategoryOf(cat.key),
        unit: cat.unit,
        defaultPrice: cat.defaultPrice.toFixed(2),
        isDeduction: Boolean(cat.deduction),
      });
    }
    for (const cat of getCostCategories(projectCode)) {
      rows.push({
        projectCode,
        kind: "cost",
        categoryKey: cat.key,
        label: cat.label,
        subCategory: subCategoryOf(cat.key),
        unit: null,
        defaultPrice: "0.00",
        isDeduction: false,
      });
    }
  }

  for (const row of rows) {
    await db
      .insert(masterCategories)
      .values(row)
      .onConflictDoUpdate({
        target: [masterCategories.projectCode, masterCategories.kind, masterCategories.categoryKey],
        set: {
          label: row.label,
          subCategory: row.subCategory,
          unit: row.unit,
          defaultPrice: row.defaultPrice,
          isDeduction: row.isDeduction,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  return { projects: codes.length, rows: rows.length };
}
