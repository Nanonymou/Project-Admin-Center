import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";

/**
 * Sales transactions + their change-log mock for the "Riwayat Perubahan
 * Penjualan" page. Each transaction carries a small append-only history of
 * create/update actions. Config-driven and keyed by project code. No database
 * required.
 */

export type SalesChangeAction = "create" | "update";

export type SalesChangeEntry = {
  action: SalesChangeAction;
  field: string;
  before: string | null;
  after: string | null;
  editor: string;
  at: string; // ISO date-time
};

export type SalesTransaction = {
  id: string;
  trxDate: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  categoryLabel: string;
  qty: number;
  price: number;
  total: number;
  editedCount: number;
  history: SalesChangeEntry[];
};

const EDITORS = ["Admin KM22", "Admin Pomala", "Admin Muara Badak", "Admin Mutiara", "Leader Admin"];

function seeded(n: number): number {
  const x = Math.sin(n * 349.11) * 10000;
  return x - Math.floor(x);
}

function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Build recent sales transactions with per-transaction change history. */
export function buildSalesTransactions(perSite = 4): SalesTransaction[] {
  const out: SalesTransaction[] = [];
  MOCK_WORKSPACES.forEach((w, si) => {
    const cats = getServiceCategories(w.projectCode).filter((c) => !c.deduction);
    for (let i = 0; i < perSite; i++) {
      const seed = si * 41 + i;
      const cat = cats[i % cats.length];
      const price = cat?.defaultPrice ?? 40000;
      const qty = 40 + Math.floor(seeded(seed) * 120);
      const total = qty * price;
      const edited = seeded(seed + 1) > 0.55;

      const history: SalesChangeEntry[] = [
        {
          action: "create",
          field: "entri",
          before: null,
          after: `${qty} × ${price}`,
          editor: EDITORS[si % EDITORS.length],
          at: isoDaysAgo(i + 1, 8),
        },
      ];
      if (edited) {
        const oldQty = qty - (5 + Math.floor(seeded(seed + 2) * 15));
        history.push({
          action: "update",
          field: "qty",
          before: String(oldQty),
          after: String(qty),
          editor: EDITORS[(si + 1) % EDITORS.length],
          at: isoDaysAgo(i, 14),
        });
      }

      out.push({
        id: `sx-${w.locationId}-${i}`,
        trxDate: isoDaysAgo(i, 8).slice(0, 10),
        projectCode: w.projectCode,
        locationId: w.locationId,
        locationName: w.locationName,
        categoryLabel: cat?.label ?? "Penjualan",
        qty,
        price,
        total,
        editedCount: history.filter((h) => h.action === "update").length,
        history: history.sort((a, b) => (a.at < b.at ? -1 : 1)),
      });
    }
  });
  return out.sort((a, b) => (a.trxDate < b.trxDate ? 1 : a.trxDate > b.trxDate ? -1 : 0));
}
