import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { mealPrices, type MealPrice, type NewMealPrice } from "@/db/schema";

export type MealPriceFilter = {
  projectCode: string;
  locationId?: string;
  activeOnly?: boolean;
};

/**
 * List Harga Meals rows for a project (optionally a single site). Repository
 * Pattern: all DB access to meal_prices flows through this module.
 */
export async function listMealPrices(filter: MealPriceFilter): Promise<MealPrice[]> {
  const conds: SQL[] = [eq(mealPrices.projectCode, filter.projectCode)];
  if (filter.locationId) conds.push(eq(mealPrices.locationId, filter.locationId));
  if (filter.activeOnly) conds.push(eq(mealPrices.active, true));
  return db
    .select()
    .from(mealPrices)
    .where(and(...conds))
    .orderBy(asc(mealPrices.categoryKey));
}

/** Upsert a meal price by (projectCode, locationId, categoryKey). */
export async function upsertMealPrice(values: NewMealPrice): Promise<void> {
  await db
    .insert(mealPrices)
    .values(values)
    .onConflictDoUpdate({
      target: [mealPrices.projectCode, mealPrices.locationId, mealPrices.categoryKey],
      set: {
        label: values.label,
        unit: values.unit,
        price: values.price,
        custom: values.custom,
        active: values.active ?? true,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate a meal price row. */
export async function setMealPriceActive(
  projectCode: string,
  locationId: string,
  categoryKey: string,
  active: boolean,
): Promise<void> {
  await db
    .update(mealPrices)
    .set({ active, updatedAt: new Date() })
    .where(
      and(
        eq(mealPrices.projectCode, projectCode),
        eq(mealPrices.locationId, locationId),
        eq(mealPrices.categoryKey, categoryKey),
      ),
    );
}
