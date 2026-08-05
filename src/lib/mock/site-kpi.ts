import { MOCK_WORKSPACES } from "./workspaces";

export type SiteKpi = {
  projectCode: string;
  projectName: string;
  locationId: string;
  locationName: string;
  invoicePeriod: string;
  sales: number;
  cost: number;
  netMargin: number;
  marginPct: number;
  slaPct: number;
  overdueInvoices: number;
  pendingApprovals: number;
  closingStatus: "open" | "closing" | "locked";
  cutOffDaysLeft: number;
  agingBuckets: { bucket: "0-30" | "31-60" | "61-90" | ">90"; amount: number }[];
  trend7d: { day: string; sales: number; cost: number }[];
  prevPeriod?: {
    sales: number;
    marginPct: number;
    slaPct: number;
  };
};

const day = (offsetFromToday: number) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - offsetFromToday));
  return d.toLocaleDateString("id-ID", { weekday: "short" });
};

function trend(baseSales: number, baseCost: number): SiteKpi["trend7d"] {
  return Array.from({ length: 7 }, (_, i) => {
    const jitter = 0.85 + ((i * 13) % 30) / 100;
    return {
      day: day(i),
      sales: Math.round(baseSales * jitter),
      cost: Math.round(baseCost * jitter * 0.92),
    };
  });
}

const RAW: Omit<SiteKpi, "projectName" | "invoicePeriod">[] = [
  {
    projectCode: "BUMA",
    locationId: "loc-km22",
    locationName: "KM22",
    sales: 1_820_000_000,
    cost: 742_000_000,
    netMargin: 1_078_000_000,
    marginPct: 59.2,
    slaPct: 96,
    overdueInvoices: 1,
    pendingApprovals: 4,
    closingStatus: "open",
    cutOffDaysLeft: 6,
    agingBuckets: [
      { bucket: "0-30", amount: 640_000_000 },
      { bucket: "31-60", amount: 210_000_000 },
      { bucket: "61-90", amount: 45_000_000 },
      { bucket: ">90", amount: 12_000_000 },
    ],
    trend7d: trend(255_000_000, 108_000_000),
  },
  {
    projectCode: "BUMA",
    locationId: "loc-km92",
    locationName: "KM92",
    sales: 1_540_000_000,
    cost: 668_000_000,
    netMargin: 872_000_000,
    marginPct: 56.6,
    slaPct: 92,
    overdueInvoices: 2,
    pendingApprovals: 6,
    closingStatus: "open",
    cutOffDaysLeft: 6,
    agingBuckets: [
      { bucket: "0-30", amount: 510_000_000 },
      { bucket: "31-60", amount: 188_000_000 },
      { bucket: "61-90", amount: 32_000_000 },
      { bucket: ">90", amount: 22_000_000 },
    ],
    trend7d: trend(215_000_000, 96_000_000),
  },
  {
    projectCode: "POMALA",
    locationId: "loc-pomala",
    locationName: "Pomala",
    sales: 1_120_000_000,
    cost: 498_000_000,
    netMargin: 622_000_000,
    marginPct: 55.5,
    slaPct: 95,
    overdueInvoices: 0,
    pendingApprovals: 3,
    closingStatus: "closing",
    cutOffDaysLeft: 2,
    agingBuckets: [
      { bucket: "0-30", amount: 420_000_000 },
      { bucket: "31-60", amount: 120_000_000 },
      { bucket: "61-90", amount: 20_000_000 },
      { bucket: ">90", amount: 0 },
    ],
    trend7d: trend(160_000_000, 72_000_000),
  },
  {
    projectCode: "PHSS",
    locationId: "loc-muara-badak",
    locationName: "Muara Badak",
    sales: 985_000_000,
    cost: 481_000_000,
    netMargin: 504_000_000,
    marginPct: 51.2,
    slaPct: 82,
    overdueInvoices: 3,
    pendingApprovals: 7,
    closingStatus: "closing",
    cutOffDaysLeft: 2,
    agingBuckets: [
      { bucket: "0-30", amount: 360_000_000 },
      { bucket: "31-60", amount: 154_000_000 },
      { bucket: "61-90", amount: 61_000_000 },
      { bucket: ">90", amount: 38_000_000 },
    ],
    trend7d: trend(140_000_000, 68_000_000),
  },
  {
    projectCode: "PHSS",
    locationId: "loc-mutiara",
    locationName: "Mutiara",
    sales: 820_000_000,
    cost: 398_000_000,
    netMargin: 422_000_000,
    marginPct: 51.5,
    slaPct: 97,
    overdueInvoices: 0,
    pendingApprovals: 2,
    closingStatus: "open",
    cutOffDaysLeft: 21,
    agingBuckets: [
      { bucket: "0-30", amount: 310_000_000 },
      { bucket: "31-60", amount: 96_000_000 },
      { bucket: "61-90", amount: 12_000_000 },
      { bucket: ">90", amount: 0 },
    ],
    trend7d: trend(118_000_000, 56_000_000),
  },
  {
    projectCode: "PHKT",
    locationId: "loc-santan",
    locationName: "Santan",
    sales: 640_000_000,
    cost: 341_000_000,
    netMargin: 299_000_000,
    marginPct: 46.7,
    slaPct: 74,
    overdueInvoices: 5,
    pendingApprovals: 1,
    closingStatus: "locked",
    cutOffDaysLeft: 0,
    agingBuckets: [
      { bucket: "0-30", amount: 210_000_000 },
      { bucket: "31-60", amount: 148_000_000 },
      { bucket: "61-90", amount: 74_000_000 },
      { bucket: ">90", amount: 61_000_000 },
    ],
    trend7d: trend(92_000_000, 48_000_000),
  },
  {
    projectCode: "PHKT",
    locationId: "loc-attaka-nib",
    locationName: "Attaka NIB",
    sales: 480_000_000,
    cost: 226_000_000,
    netMargin: 254_000_000,
    marginPct: 52.9,
    slaPct: 100,
    overdueInvoices: 0,
    pendingApprovals: 0,
    closingStatus: "open",
    cutOffDaysLeft: 21,
    agingBuckets: [
      { bucket: "0-30", amount: 190_000_000 },
      { bucket: "31-60", amount: 62_000_000 },
      { bucket: "61-90", amount: 0 },
      { bucket: ">90", amount: 0 },
    ],
    trend7d: trend(70_000_000, 32_000_000),
  },
];

export const SITE_KPI: SiteKpi[] = RAW.map((row, i) => {
  const ws = MOCK_WORKSPACES.find(
    (w) => w.projectCode === row.projectCode && w.locationId === row.locationId,
  );
  const jitter = 0.88 + ((i * 37) % 24) / 100;
  return {
    ...row,
    projectName: ws?.projectName ?? row.projectCode,
    invoicePeriod: ws?.invoicePeriod ?? "-",
    prevPeriod: {
      sales: Math.round(row.sales * jitter),
      marginPct: Math.max(30, row.marginPct - ((i * 7) % 8) + 3),
      slaPct: Math.max(60, Math.min(100, row.slaPct - ((i * 3) % 6) + 2)),
    },
  };
});

export type PortfolioTotals = {
  sales: number;
  cost: number;
  netMargin: number;
  marginPct: number;
  slaPct: number;
  overdueInvoices: number;
  pendingApprovals: number;
  siteCount: number;
};

export function aggregateTotals(sites: SiteKpi[]): PortfolioTotals {
  const sum = sites.reduce(
    (acc, s) => {
      acc.sales += s.sales;
      acc.cost += s.cost;
      acc.netMargin += s.netMargin;
      acc.overdueInvoices += s.overdueInvoices;
      acc.pendingApprovals += s.pendingApprovals;
      acc.slaWeighted += s.slaPct;
      return acc;
    },
    { sales: 0, cost: 0, netMargin: 0, overdueInvoices: 0, pendingApprovals: 0, slaWeighted: 0 },
  );
  const siteCount = sites.length;
  return {
    sales: sum.sales,
    cost: sum.cost,
    netMargin: sum.netMargin,
    marginPct: sum.sales === 0 ? 0 : (sum.netMargin / sum.sales) * 100,
    slaPct: siteCount === 0 ? 0 : sum.slaWeighted / siteCount,
    overdueInvoices: sum.overdueInvoices,
    pendingApprovals: sum.pendingApprovals,
    siteCount,
  };
}

/**
 * Scale SITE_KPI monthly-baseline values by the length of the selected
 * global period, so period filters actually move ranking / profit /
 * margin numbers. Margin % and SLA % are intensive and left untouched.
 */
export function scaleSiteKpisByPeriod(
  sites: SiteKpi[],
  from: string,
  to: string,
  baselineDays = 30,
): SiteKpi[] {
  const days = daysBetween(from, to);
  if (days <= 0 || baselineDays <= 0) return sites;
  const factor = Math.max(0.05, days / baselineDays);
  return sites.map((s) => ({
    ...s,
    sales: Math.round(s.sales * factor),
    cost: Math.round(s.cost * factor),
    netMargin: Math.round(s.netMargin * factor),
    prevPeriod: s.prevPeriod
      ? {
          ...s.prevPeriod,
          sales: Math.round(s.prevPeriod.sales * factor),
        }
      : s.prevPeriod,
  }));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(`${fromIso}T00:00:00Z`);
  const toMs = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return 0;
  return Math.max(1, Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1);
}

export function aggregateAging(sites: SiteKpi[]) {
  const buckets: Record<"0-30" | "31-60" | "61-90" | ">90", number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    ">90": 0,
  };
  for (const s of sites) {
    for (const b of s.agingBuckets) buckets[b.bucket] += b.amount;
  }
  return (Object.keys(buckets) as (keyof typeof buckets)[]).map((k) => ({
    bucket: k,
    amount: buckets[k],
  }));
}
