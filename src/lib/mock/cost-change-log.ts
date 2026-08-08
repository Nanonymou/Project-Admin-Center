import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getCostCategories } from "@/lib/mock/cost-config";

/**
 * Cost change-log mock — an append-only trail of edits to Daily Cost entries
 * (create / update / delete) for the "Riwayat Perubahan Pengeluaran" page.
 * Config-driven and keyed by project code from the shared workspace config; the
 * `before`/`after` amounts capture what changed. No database required.
 */

export const COST_CHANGE_ACTIONS = ["create", "update", "delete"] as const;
export type CostChangeAction = (typeof COST_CHANGE_ACTIONS)[number];

export type CostChangeEntry = {
  id: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  trxDate: string; // the cost entry's transaction date
  categoryLabel: string;
  action: CostChangeAction;
  before: number | null;
  after: number | null;
  editor: string;
  at: string; // ISO date-time of the change
  reason?: string;
};

const EDITORS = ["Admin KM22", "Admin Pomala", "Admin Muara Badak", "Leader Admin", "Admin Mutiara"];
const REASONS: Record<CostChangeAction, string> = {
  create: "Input awal pengeluaran harian.",
  update: "Koreksi nominal sesuai bukti.",
  delete: "Entri ganda dihapus.",
};

function seeded(n: number): number {
  const x = Math.sin(n * 733.17) * 10000;
  return x - Math.floor(x);
}

/** Build a stable list of cost change-log entries across all configured sites. */
export function buildCostChangeLog(count = 40): CostChangeEntry[] {
  const sites = MOCK_WORKSPACES;
  const out: CostChangeEntry[] = [];
  for (let i = 0; i < count; i++) {
    const site = sites[i % sites.length];
    const cats = getCostCategories(site.projectCode);
    const cat = cats[i % cats.length];
    const action = COST_CHANGE_ACTIONS[Math.floor(seeded(i + 5) * COST_CHANGE_ACTIONS.length)];
    const base = 500000 + Math.round(seeded(i + 2) * 4_500_000);

    const changedAt = new Date();
    changedAt.setDate(changedAt.getDate() - (i % 18));
    changedAt.setHours(8 + (i % 10), (i * 11) % 60, 0, 0);

    const trxDate = new Date(changedAt);
    trxDate.setDate(trxDate.getDate() - 1);

    let before: number | null = null;
    let after: number | null = null;
    if (action === "create") {
      after = base;
    } else if (action === "delete") {
      before = base;
    } else {
      before = base;
      after = Math.round(base * (0.6 + seeded(i + 8) * 0.8));
    }

    out.push({
      id: `chg-${String(i + 1).padStart(4, "0")}`,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      trxDate: trxDate.toISOString().slice(0, 10),
      categoryLabel: cat?.label ?? "Pengeluaran",
      action,
      before,
      after,
      editor: EDITORS[i % EDITORS.length],
      at: changedAt.toISOString(),
      reason: REASONS[action],
    });
  }
  // Newest change first.
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const COST_CHANGE_ACTION_META: Record<
  CostChangeAction,
  { label: string; badge: "success" | "info" | "danger" }
> = {
  create: { label: "Dibuat", badge: "success" },
  update: { label: "Diubah", badge: "info" },
  delete: { label: "Dihapus", badge: "danger" },
};
