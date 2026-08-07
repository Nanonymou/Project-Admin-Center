import type { SiteKpi } from "@/lib/mock/site-kpi";

export type RecentActivityItem = {
  id: string;
  minutesAgo: number;
  timeLabel: string;
  actor: string;
  action: string;
  target: string;
  status: "info" | "success" | "warning" | "danger";
};

export type SiteRecentActivity = {
  projectId: string;
  locationId: string;
  locationName: string;
  items: RecentActivityItem[];
};

const ACTIONS: { action: string; status: RecentActivityItem["status"] }[] = [
  { action: "Submit Daily Sales", status: "info" },
  { action: "Input Daily Cost", status: "info" },
  { action: "Submit Daily Closing", status: "success" },
  { action: "Approve Invoice", status: "success" },
  { action: "Reminder SLA H-3", status: "warning" },
  { action: "Invoice Overdue", status: "danger" },
];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function timeLabel(mins: number): string {
  if (mins < 60) return `${mins} mnt lalu`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} jam lalu`;
  return `${Math.round(mins / (60 * 24))} hari lalu`;
}

/**
 * Recent activity feed per site — deterministic, most-recent first. Backs the
 * "Aktivitas Terbaru" reminder widget with per-site data.
 */
export function buildRecentActivityPerSite(sites: SiteKpi[], perSite = 5): SiteRecentActivity[] {
  return sites.map((site) => {
    const seed = seedOf(site.locationId);
    const items: RecentActivityItem[] = [];
    for (let i = 0; i < perSite; i++) {
      const a = ACTIONS[(seed + i) % ACTIONS.length];
      const minutesAgo = (i + 1) * (12 + (seed % 40)) + (seed % 7);
      items.push({
        id: `${site.locationId}-act-${i}`,
        minutesAgo,
        timeLabel: timeLabel(minutesAgo),
        actor: i % 2 === 0 ? `Site Admin — ${site.locationName}` : "Leader Admin",
        action: a.action,
        target: `${site.projectCode}/${String((seed % 900) + 100)}`,
        status: a.status,
      });
    }
    items.sort((x, y) => x.minutesAgo - y.minutesAgo);
    return {
      projectId: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      items,
    };
  });
}
