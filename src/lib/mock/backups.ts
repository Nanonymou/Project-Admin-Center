/** Mock backup snapshots for the Backup & Restore admin page. */
export type BackupType = "auto" | "manual";
export type BackupStatus = "completed" | "in_progress" | "failed";

export type BackupSnapshot = {
  id: string;
  createdAt: string;
  createdBy: string;
  type: BackupType;
  scope: string;
  sizeMb: number;
  status: BackupStatus;
  records: number;
};

export const BACKUP_STATUS_META: Record<
  BackupStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  completed: { label: "Selesai", variant: "success" },
  in_progress: { label: "Berlangsung", variant: "warning" },
  failed: { label: "Gagal", variant: "danger" },
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/** Deterministic backup history for the given number of past days. */
export function buildBackups(count = 12): BackupSnapshot[] {
  const owners = ["System", "Leader Admin", "Super Admin"];
  const scopes = ["Seluruh Project", "Master Data", "Transaksi Harian", "Konfigurasi"];
  const out: BackupSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seedOf(`backup-${i}`);
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(2, 0, 0, 0);
    const type: BackupType = i % 4 === 0 ? "manual" : "auto";
    const status: BackupStatus = i === 0 && seed % 5 === 0 ? "in_progress" : seed % 11 === 0 ? "failed" : "completed";
    out.push({
      id: `bkp-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
      createdAt: d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      createdBy: type === "manual" ? owners[1 + (seed % 2)] : "System",
      type,
      scope: scopes[seed % scopes.length],
      sizeMb: Math.round((40 + (seed % 180)) * 10) / 10,
      status,
      records: 1200 + (seed % 8000),
    });
  }
  return out;
}
