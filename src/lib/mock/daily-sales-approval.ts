import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/**
 * Daily Sales approval mock — one submission per site per recent day with an
 * approval status. Config-driven and keyed by project code from the shared
 * workspace config. Used by the "Persetujuan Daily Sales" page. No database
 * required.
 */

export const DS_APPROVAL_STATUSES = ["submitted", "reviewed", "approved", "rejected"] as const;
export type DsApprovalStatus = (typeof DS_APPROVAL_STATUSES)[number];

export type DailySalesSubmission = {
  id: string;
  trxDate: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  total: number;
  itemCount: number;
  submittedBy: string;
  status: DsApprovalStatus;
};

const SUBMITTERS = ["Admin KM22", "Admin Pomala", "Admin Muara Badak", "Admin Mutiara", "Admin PHKT"];

function seeded(n: number): number {
  const x = Math.sin(n * 517.31) * 10000;
  return x - Math.floor(x);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Build recent Daily Sales submissions across all configured sites. */
export function buildDailySalesSubmissions(daysPerSite = 4): DailySalesSubmission[] {
  const out: DailySalesSubmission[] = [];
  MOCK_WORKSPACES.forEach((w, si) => {
    for (let d = 0; d < daysPerSite; d++) {
      const seed = si * 31 + d;
      // Newer days are earlier in the flow; older days are approved.
      const status: DsApprovalStatus =
        d === 0
          ? "submitted"
          : d === 1
            ? seeded(seed) > 0.5
              ? "reviewed"
              : "submitted"
            : seeded(seed + 3) > 0.15
              ? "approved"
              : "rejected";
      out.push({
        id: `ds-${w.locationId}-${d}`,
        trxDate: isoDaysAgo(d),
        projectCode: w.projectCode,
        locationId: w.locationId,
        locationName: w.locationName,
        total: 8_000_000 + Math.round(seeded(seed + 1) * 30_000_000),
        itemCount: 3 + Math.floor(seeded(seed + 2) * 6),
        submittedBy: SUBMITTERS[si % SUBMITTERS.length],
        status,
      });
    }
  });
  return out.sort((a, b) => (a.trxDate < b.trxDate ? 1 : a.trxDate > b.trxDate ? -1 : 0));
}

export const DS_STATUS_META: Record<
  DsApprovalStatus,
  { label: string; badge: "info" | "warning" | "success" | "danger" }
> = {
  submitted: { label: "Menunggu Review", badge: "info" },
  reviewed: { label: "Direview", badge: "warning" },
  approved: { label: "Disetujui", badge: "success" },
  rejected: { label: "Ditolak", badge: "danger" },
};
