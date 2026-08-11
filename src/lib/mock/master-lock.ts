/**
 * Master Lock & Version Management (config-driven mock). Per PRD §Master Lock &
 * Version Management, every master-data domain can be locked to protect its
 * integrity, and each change is versioned non-destructively so it can be traced
 * and restored. This mock lists the lockable master entities with their current
 * lock state and version metadata. Frontend-first: the Master Lock pages drive
 * this until the lock/version tables and API land.
 */

export type MasterEntity = {
  key: string;
  label: string;
  category: string;
  /** Route of the page that manages this master domain, when one exists. */
  href?: string;
  locked: boolean;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string; // ISO date
};

export type MasterVersion = {
  version: number;
  changedBy: string;
  at: string; // ISO date-time
  summary: string;
};

const ENTITIES: MasterEntity[] = [
  { key: "pricing", label: "Master Pricing", category: "Keuangan", href: "/master-pricing", locked: false, version: 7, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-28" },
  { key: "formula", label: "Formula Engine", category: "Keuangan", href: "/formula-engine", locked: true, version: 4, lastModifiedBy: "Andi Prasetya", lastModifiedAt: "2026-07-15" },
  { key: "tax", label: "Master Tax", category: "Keuangan", locked: true, version: 3, lastModifiedBy: "Andi Prasetya", lastModifiedAt: "2026-06-30" },
  { key: "workflow", label: "Workflow Approval", category: "Proses", href: "/workflow-default-approval", locked: false, version: 5, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-22" },
  { key: "timeframe", label: "Master Timeframe", category: "Proses", href: "/master-timeframe", locked: false, version: 6, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-25" },
  { key: "service_category", label: "Kategori Sales", category: "Operasional", href: "/kategori-sales", locked: false, version: 2, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-10" },
  { key: "invoice_type", label: "Jenis Invoice", category: "Operasional", href: "/jenis-invoice", locked: false, version: 2, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-05" },
  { key: "doc_numbering", label: "Penomoran Dokumen", category: "Sistem", locked: true, version: 1, lastModifiedBy: "Andi Prasetya", lastModifiedAt: "2026-05-20" },
  { key: "customer_vendor", label: "Customer & Vendor", category: "Relasi", href: "/master-customer-vendor", locked: false, version: 3, lastModifiedBy: "Randi Setiawan", lastModifiedAt: "2026-07-18" },
];

export const LOCK_CATEGORIES = ["Keuangan", "Proses", "Operasional", "Relasi", "Sistem"] as const;

export function listMasterEntities(): MasterEntity[] {
  return ENTITIES;
}

const EDITORS = ["Randi Setiawan", "Andi Prasetya"];

/** Deterministic 0..1 from a seed. */
function seeded(n: number): number {
  const x = Math.sin(n * 91.7) * 10000;
  return x - Math.floor(x);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + (days % 6), (days * 7) % 60, 0, 0);
  return d.toISOString();
}

const SUMMARIES = [
  "Perubahan tarif",
  "Penyesuaian kategori",
  "Koreksi nilai parameter",
  "Penambahan entri baru",
  "Pembaruan konfigurasi",
  "Revisi struktur",
];

/** Build a non-destructive version history for an entity (newest first). */
export function buildVersionHistory(entity: MasterEntity): MasterVersion[] {
  const out: MasterVersion[] = [];
  for (let v = entity.version; v >= 1; v--) {
    const seed = entity.key.length * 13 + v * 5;
    out.push({
      version: v,
      changedBy: v === entity.version ? entity.lastModifiedBy : EDITORS[Math.floor(seeded(seed) * EDITORS.length)],
      at: v === entity.version ? `${entity.lastModifiedAt}T09:00:00.000Z` : isoDaysAgo((entity.version - v) * 12 + 3),
      summary: v === 1 ? "Versi awal" : SUMMARIES[Math.floor(seeded(seed + 1) * SUMMARIES.length)],
    });
  }
  return out;
}
