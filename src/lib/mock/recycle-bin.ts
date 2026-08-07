/** Soft-deleted records for the Recycle Bin page. */
export type DeletedType = "invoice" | "daily_sales" | "daily_cost" | "user" | "master";

export type DeletedItem = {
  id: string;
  originalId: string;
  type: DeletedType;
  label: string;
  detail: string;
  projectCode: string;
  locationName: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
  purgeDate: string;
  daysUntilPurge: number;
};

export const DELETED_TYPE_META: Record<DeletedType, { label: string; variant: "info" | "warning" | "success" | "danger" | "muted" }> = {
  invoice: { label: "Invoice", variant: "info" },
  daily_sales: { label: "Daily Sales", variant: "success" },
  daily_cost: { label: "Daily Cost", variant: "warning" },
  user: { label: "User", variant: "danger" },
  master: { label: "Master Data", variant: "muted" },
};

const TYPES: DeletedType[] = ["invoice", "daily_sales", "daily_cost", "user", "master"];
const PROJECTS = ["BUMA", "POMALA", "PHSS", "PHKT"];
const LOCATIONS = ["KM22", "KM92", "Pomala", "Muara Badak", "Santan Terminal", "Attaka"];
const ACTORS = ["Site Admin", "Leader Admin", "Super Admin"];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export function buildDeletedItems(count = 14): DeletedItem[] {
  const out: DeletedItem[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seedOf(`del-${i}`);
    const type = TYPES[seed % TYPES.length];
    const d = new Date();
    d.setDate(d.getDate() - (seed % 25));
    const project = PROJECTS[seed % PROJECTS.length];
    const location = LOCATIONS[seed % LOCATIONS.length];
    const labels: Record<DeletedType, string> = {
      invoice: `INV/2026/0${1 + (seed % 9)}/${project}/${String(100 + (seed % 800))}`,
      daily_sales: `Entri Sales ${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`,
      daily_cost: `Entri Cost ${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`,
      user: `user${100 + (seed % 400)}@catering.id`,
      master: `Konfigurasi ${["Harga", "Area", "Kategori"][seed % 3]}`,
    };
    const reasons = ["Duplikat entri", "Salah input", "Permintaan koreksi", "Data uji coba"];
    const daysUntilPurge = Math.max(1, 30 - (seed % 25));
    const purge = new Date();
    purge.setDate(purge.getDate() + daysUntilPurge);
    out.push({
      id: `del-${i}`,
      originalId: `${type.toUpperCase()}-${1000 + (seed % 9000)}`,
      type,
      label: labels[type],
      detail: `${project} · ${location}`,
      projectCode: project,
      locationName: location,
      deletedAt: d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      deletedBy: ACTORS[seed % ACTORS.length],
      reason: reasons[seed % reasons.length],
      purgeDate: purge.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
      daysUntilPurge,
    });
  }
  return out.sort((a, b) => a.daysUntilPurge - b.daysUntilPurge);
}
