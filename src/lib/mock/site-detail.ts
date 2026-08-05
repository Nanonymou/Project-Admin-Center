import { SITE_KPI, type SiteKpi } from "./site-kpi";

export type SiteDaily = {
  date: string;
  sales: number;
  cost: number;
};

export type SiteCategoryPoint = {
  category: string;
  amount: number;
};

export type SiteMarginPoint = {
  date: string;
  marginPct: number;
  target: number;
};

export type SiteApprovalStage = {
  stage: string;
  onTime: number;
  atRisk: number;
  overdue: number;
};

export type SiteInvoiceAging = {
  bucket: "0-30" | "31-60" | "61-90" | ">90";
  count: number;
  amount: number;
};

export type SiteDetail = {
  site: SiteKpi;
  daily30d: SiteDaily[];
  categories: SiteCategoryPoint[];
  marginTrend: SiteMarginPoint[];
  approvalStages: SiteApprovalStage[];
  invoiceAging: SiteInvoiceAging[];
};

const CATEGORY_TEMPLATES: Record<string, string[]> = {
  BUMA: ["Meals Buffet", "Meals Packmeal", "Housekeeping", "Laundry", "Backcharge"],
  POMALA: ["Meals Buffet", "Meals Packmeal", "HKL", "Snack Box", "Air Minum", "Extra Issue", "Backcharge"],
  PHSS: ["Meals Buffet", "Meals Packmeal", "Room Service", "Camp Cleaning", "Ground Maintenance", "Backcharge"],
  PHKT: ["Meals Buffet", "Meals Packmeal", "Accommodation", "Backcharge"],
};

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  x = x - Math.floor(x);
  return x;
}

function buildDaily(baseSales: number, seed: number): SiteDaily[] {
  const out: SiteDaily[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const jitter = 0.75 + seededRandom(seed + i) * 0.5;
    const salesDaily = Math.round((baseSales / 30) * jitter);
    const costDaily = Math.round(salesDaily * (0.38 + seededRandom(seed + i + 100) * 0.1));
    out.push({
      date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      sales: salesDaily,
      cost: costDaily,
    });
  }
  return out;
}

function buildMarginTrend(baseMarginPct: number, seed: number): SiteMarginPoint[] {
  const out: SiteMarginPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const jitter = (seededRandom(seed + i) - 0.5) * 6;
    out.push({
      date: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      marginPct: Math.max(30, Math.min(70, baseMarginPct + jitter)),
      target: 50,
    });
  }
  return out;
}

function buildCategories(projectCode: string, totalSales: number, seed: number): SiteCategoryPoint[] {
  const cats = CATEGORY_TEMPLATES[projectCode] ?? CATEGORY_TEMPLATES.BUMA;
  const weights = cats.map((_, i) => 1 + seededRandom(seed + i) * 3);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return cats.map((category, i) => ({
    category,
    amount: Math.round((weights[i] / weightSum) * totalSales),
  }));
}

function buildApprovalStages(seed: number): SiteApprovalStage[] {
  const stages = ["Verifikasi Site", "Approval Leader", "Verifikasi Finance", "Kirim Client", "Payment"];
  return stages.map((stage, i) => {
    const total = 12 + Math.floor(seededRandom(seed + i) * 20);
    const overdue = Math.floor(seededRandom(seed + i + 50) * 3);
    const atRisk = Math.floor(seededRandom(seed + i + 100) * 4);
    return {
      stage,
      onTime: Math.max(0, total - overdue - atRisk),
      atRisk,
      overdue,
    };
  });
}

function buildAging(site: SiteKpi): SiteInvoiceAging[] {
  return site.agingBuckets.map((b, i) => ({
    ...b,
    count: b.amount === 0 ? 0 : 1 + Math.floor(seededRandom(i + site.locationId.length) * 6),
  }));
}

export const SITE_DETAILS: Record<string, SiteDetail> = Object.fromEntries(
  SITE_KPI.map((site, i) => {
    const seed = i * 17 + site.locationName.length;
    return [
      site.locationId,
      {
        site,
        daily30d: buildDaily(site.sales, seed),
        categories: buildCategories(site.projectCode, site.sales, seed + 5),
        marginTrend: buildMarginTrend(site.marginPct, seed + 11),
        approvalStages: buildApprovalStages(seed + 23),
        invoiceAging: buildAging(site),
      } satisfies SiteDetail,
    ];
  }),
);

export function getSiteDetail(locationId: string): SiteDetail | undefined {
  return SITE_DETAILS[locationId];
}
