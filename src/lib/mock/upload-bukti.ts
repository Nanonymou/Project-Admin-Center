import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/**
 * Evidence ("bukti") upload mock data for the Upload Bukti page. Config-driven —
 * evidence kinds and statuses are generic, keyed by project code from the shared
 * workspace config so the same component serves every project without any
 * project-named data. No live database is required; the page seeds from here.
 */

/** Generic evidence categories (proof-of-transaction types). */
export const BUKTI_KINDS = [
  { key: "payment", label: "Bukti Pembayaran" },
  { key: "invoice", label: "Bukti Invoice" },
  { key: "delivery", label: "Bukti Serah Terima" },
  { key: "receipt", label: "Bukti Kwitansi" },
  { key: "cost", label: "Bukti Pengeluaran" },
] as const;

export type BuktiKind = (typeof BUKTI_KINDS)[number]["key"];

/** Review lifecycle of an uploaded evidence file. */
export const BUKTI_STATUSES = ["pending", "verified", "rejected"] as const;
export type BuktiStatus = (typeof BUKTI_STATUSES)[number];

export type BuktiFileType = "image" | "pdf";

export type BuktiRecord = {
  id: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  kind: BuktiKind;
  kindLabel: string;
  fileName: string;
  fileType: BuktiFileType;
  sizeKb: number;
  status: BuktiStatus;
  reference: string;
  uploadedBy: string;
  uploadedAt: string; // ISO date-time
  note?: string;
  /** Object URL for locally uploaded files; seeded mock rows have none. */
  url?: string;
};

const UPLOADERS = ["Admin KM22", "Admin Pomala", "Admin Muara Badak", "Leader Admin", "Admin Mutiara"];
const FILE_EXT: Record<BuktiFileType, string> = { image: "jpg", pdf: "pdf" };

/** Deterministic pseudo-random so the mock is stable across renders. */
function seeded(n: number): number {
  const x = Math.sin(n * 999.13) * 10000;
  return x - Math.floor(x);
}

/** Build a stable list of mock evidence records across all configured sites. */
export function buildBuktiRecords(count = 24): BuktiRecord[] {
  const sites = MOCK_WORKSPACES;
  const out: BuktiRecord[] = [];
  for (let i = 0; i < count; i++) {
    const site = sites[i % sites.length];
    const kind = BUKTI_KINDS[i % BUKTI_KINDS.length];
    const fileType: BuktiFileType = seeded(i + 3) > 0.5 ? "image" : "pdf";
    const status = BUKTI_STATUSES[Math.floor(seeded(i + 7) * BUKTI_STATUSES.length)];
    const d = new Date();
    d.setDate(d.getDate() - (i % 21));
    d.setHours(8 + (i % 9), (i * 13) % 60, 0, 0);
    const seq = String(i + 1).padStart(4, "0");
    out.push({
      id: `bukti-${seq}`,
      projectCode: site.projectCode,
      locationId: site.locationId,
      locationName: site.locationName,
      kind: kind.key,
      kindLabel: kind.label,
      fileName: `${kind.key}-${site.projectCode.toLowerCase()}-${seq}.${FILE_EXT[fileType]}`,
      fileType,
      sizeKb: 120 + Math.round(seeded(i + 11) * 2400),
      status,
      reference: `${kind.key.toUpperCase()}/${site.projectCode}/${seq}`,
      uploadedBy: UPLOADERS[i % UPLOADERS.length],
      uploadedAt: d.toISOString(),
      note: status === "rejected" ? "Berkas buram, mohon unggah ulang." : undefined,
    });
  }
  return out;
}

/** Status → badge/label metadata for the UI. */
export const BUKTI_STATUS_META: Record<
  BuktiStatus,
  { label: string; badge: "warning" | "success" | "danger" }
> = {
  pending: { label: "Menunggu Verifikasi", badge: "warning" },
  verified: { label: "Terverifikasi", badge: "success" },
  rejected: { label: "Ditolak", badge: "danger" },
};
