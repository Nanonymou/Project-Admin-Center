/**
 * Master Tax Engine (config-driven mock). Per PRD §Master Tax Engine, the system
 * supports multiple tax types (PPN, PB1, PPh, PPD, …) configured centrally and
 * activated per project for regional-regulation flexibility. This mock is the
 * tax-type catalogue with rates and versions; the per-project assignment is a
 * separate view. Frontend-first: pages drive this until the tax tables and API
 * land.
 */

export type TaxCategory = "PPN" | "PB1" | "PPh" | "PPD" | "Lainnya";

export type TaxType = {
  code: string;
  label: string;
  category: TaxCategory;
  rate: number; // fractional, e.g. 0.11
  description: string;
  version: number;
  active: boolean;
};

export const TAX_CATEGORY_META: Record<TaxCategory, { label: string; variant: "info" | "success" | "warning" | "danger" | "muted" }> = {
  PPN: { label: "PPN", variant: "info" },
  PB1: { label: "PB1", variant: "success" },
  PPh: { label: "PPh", variant: "warning" },
  PPD: { label: "PPD", variant: "danger" },
  Lainnya: { label: "Lainnya", variant: "muted" },
};

const TAXES: TaxType[] = [
  { code: "PPN11", label: "PPN 11%", category: "PPN", rate: 0.11, description: "Pajak Pertambahan Nilai standar nasional.", version: 2, active: true },
  { code: "PB1", label: "PB1 10%", category: "PB1", rate: 0.1, description: "Pajak Pembangunan I (pajak restoran/jasa boga daerah).", version: 1, active: true },
  { code: "PPH23", label: "PPh 23 (2%)", category: "PPh", rate: 0.02, description: "Pajak Penghasilan atas jasa (dipotong).", version: 1, active: true },
  { code: "PPD", label: "Pajak Pembangunan Daerah (1%)", category: "PPD", rate: 0.01, description: "Retribusi daerah untuk sebagian project.", version: 1, active: false },
  { code: "SVC", label: "Service Charge (5%)", category: "Lainnya", rate: 0.05, description: "Biaya layanan opsional per kontrak.", version: 1, active: true },
];

export function listTaxTypes(): TaxType[] {
  return TAXES;
}

export function getTaxType(code: string): TaxType | undefined {
  return TAXES.find((t) => t.code === code);
}

const EDITORS = ["Andi Prasetya", "Randi Setiawan"];
const SUMMARIES = ["Penyesuaian tarif", "Perubahan deskripsi", "Aktivasi ulang", "Koreksi kategori"];

function seeded(n: number): number {
  const x = Math.sin(n * 57.3) * 10000;
  return x - Math.floor(x);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, (days * 11) % 60, 0, 0);
  return d.toISOString();
}

export type TaxVersion = { version: number; rate: number; changedBy: string; at: string; summary: string };

/** Build a version history for a tax type (newest first), rates trending to current. */
export function buildTaxVersions(tax: TaxType): TaxVersion[] {
  const out: TaxVersion[] = [];
  for (let v = tax.version; v >= 1; v--) {
    const seed = tax.code.length * 9 + v * 3;
    const rate = v === tax.version ? tax.rate : Math.max(0.005, tax.rate - (tax.version - v) * 0.01);
    out.push({
      version: v,
      rate: Math.round(rate * 1000) / 1000,
      changedBy: EDITORS[Math.floor(seeded(seed) * EDITORS.length)],
      at: v === tax.version ? isoDaysAgo(10) : isoDaysAgo((tax.version - v) * 40 + 20),
      summary: v === 1 ? "Versi awal" : SUMMARIES[Math.floor(seeded(seed + 1) * SUMMARIES.length)],
    });
  }
  return out;
}
