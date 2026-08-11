import { getPricedCategories, type PricedCategory } from "@/lib/mock/pricing-config";

/**
 * Master Pricing change-log mock for the "Riwayat Perubahan Harga" view on the
 * Harga Meals page. Per PRD §Master Lock & Version Management, every change to
 * Master Pricing is stored non-destructively so it can be traced without
 * overwriting the previous value. This mock derives a deterministic, seeded
 * history per site (config-driven, no database) so each site shows its own
 * price-change trail.
 */

export type PriceChangeAction = "create" | "update" | "activate" | "deactivate";

export type PriceChangeEntry = {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  action: PriceChangeAction;
  /** Previous price (Rupiah) for an update; null for create/activate/deactivate. */
  before: number | null;
  /** New price (Rupiah) for create/update; null for activate/deactivate. */
  after: number | null;
  editor: string;
  at: string; // ISO date-time
};

const EDITORS = ["Leader Admin", "Admin KM22", "Admin Pomala", "Admin Muara Badak", "Admin Mutiara"];

/** Deterministic 0..1 from an integer seed. */
function seeded(n: number): number {
  const x = Math.sin(n * 233.77) * 10000;
  return x - Math.floor(x);
}

function isoDaysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, Math.floor(seeded(days + hour) * 55), 0, 0);
  return d.toISOString();
}

/** Round to the nearest Rp500, matching the pricing engine's granularity. */
function roundPrice(n: number): number {
  return Math.max(0, Math.round(n / 500) * 500);
}

/**
 * Build the seeded price-change history for a site. Meal/service categories that
 * happen to have been revised get one or two update entries; every category has
 * an initial "create" entry so the trail is complete. Newest first.
 */
export function buildPriceChanges(projectCode: string, locationId: string): PriceChangeEntry[] {
  const cats: PricedCategory[] = getPricedCategories(projectCode, locationId).filter((c) => !c.deduction);
  const out: PriceChangeEntry[] = [];

  cats.forEach((cat, ci) => {
    const seedBase = locationId.length * 17 + ci * 7;
    const current = cat.price;

    // Was this category's price revised since it was created?
    const revised = seeded(seedBase + 1) > 0.5;
    const revisedTwice = revised && seeded(seedBase + 5) > 0.7;

    // Reconstruct the price at creation working backwards from the current
    // value so the timeline is internally consistent (create → update → now).
    const firstBump = roundPrice(current * (0.88 + seeded(seedBase + 2) * 0.08));
    const originalPrice = revisedTwice
      ? roundPrice(firstBump * (0.9 + seeded(seedBase + 3) * 0.06))
      : firstBump;

    out.push({
      id: `${locationId}-${cat.key}-create`,
      categoryKey: cat.key,
      categoryLabel: cat.label,
      action: "create",
      before: null,
      after: revised ? originalPrice : current,
      editor: EDITORS[(ci + 1) % EDITORS.length],
      at: isoDaysAgo(60 + ci, 9),
    });

    if (revisedTwice) {
      out.push({
        id: `${locationId}-${cat.key}-update-1`,
        categoryKey: cat.key,
        categoryLabel: cat.label,
        action: "update",
        before: originalPrice,
        after: firstBump,
        editor: EDITORS[ci % EDITORS.length],
        at: isoDaysAgo(30 + (ci % 10), 11),
      });
    }

    if (revised) {
      out.push({
        id: `${locationId}-${cat.key}-update-final`,
        categoryKey: cat.key,
        categoryLabel: cat.label,
        action: "update",
        before: revisedTwice ? firstBump : originalPrice,
        after: current,
        editor: "Leader Admin",
        at: isoDaysAgo(7 + (ci % 6), 14),
      });
    }
  });

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
