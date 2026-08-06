import type { SiteKpi } from "./site-kpi";

export type AuditAction =
  | "create"
  | "edit"
  | "submit"
  | "review"
  | "approve"
  | "reject"
  | "lock"
  | "unlock"
  | "upload"
  | "send";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actor: string;
  role: string;
  timeLabel: string;
  offsetMinutes: number;
  target: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  detail: string;
};

export const AUDIT_ACTION_META: Record<
  AuditAction,
  { label: string; variant: "info" | "success" | "warning" | "danger" | "muted" }
> = {
  create: { label: "Dibuat", variant: "muted" },
  edit: { label: "Diubah", variant: "info" },
  submit: { label: "Submit", variant: "info" },
  review: { label: "Review", variant: "warning" },
  approve: { label: "Approve", variant: "success" },
  reject: { label: "Reject", variant: "danger" },
  lock: { label: "Lock", variant: "success" },
  unlock: { label: "Unlock", variant: "warning" },
  upload: { label: "Upload", variant: "info" },
  send: { label: "Kirim", variant: "info" },
};

const FLOW: { action: AuditAction; actor: string; role: string; detail: string }[] = [
  { action: "create", actor: "Site Admin", role: "Site Admin", detail: "Entri Daily Sales dibuat (draft)." },
  { action: "edit", actor: "Site Admin", role: "Site Admin", detail: "Qty Meals Buffet disesuaikan 120 → 132." },
  { action: "submit", actor: "Site Admin", role: "Site Admin", detail: "Entri disubmit untuk review." },
  { action: "review", actor: "Leader Admin", role: "Leader Admin", detail: "Ditinjau — catatan: cek harga laundry." },
  { action: "edit", actor: "Site Admin", role: "Site Admin", detail: "Harga Laundry dikoreksi 12.000 → 12.500." },
  { action: "approve", actor: "Leader Admin", role: "Leader Admin", detail: "Entri disetujui." },
  { action: "lock", actor: "System", role: "System", detail: "Auto-lock cut-off H+1." },
];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function timeLabelFromOffset(mins: number): string {
  if (mins < 60) return `${mins} mnt lalu`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} jam lalu`;
  return `${Math.round(mins / (60 * 24))} hari lalu`;
}

/**
 * Build a mock audit trail (change history) across the given sites. Each
 * site contributes a partial workflow, most-recent first.
 */
export function buildAuditTrail(sites: SiteKpi[]): AuditEntry[] {
  const out: AuditEntry[] = [];
  sites.forEach((site, si) => {
    const seed = seedOf(site.locationId);
    const steps = 3 + (seed % (FLOW.length - 2));
    for (let i = 0; i < steps; i++) {
      const flow = FLOW[i];
      const offset = (steps - i) * (30 + (seed % 90)) + si * 7;
      out.push({
        id: `${site.locationId}-${i}`,
        action: flow.action,
        actor: flow.actor === "System" ? "System" : `${flow.actor} — ${site.locationName}`,
        role: flow.role,
        timeLabel: timeLabelFromOffset(offset),
        offsetMinutes: offset,
        target: `Daily Sales ${site.projectCode}/${String((seed % 900) + 100)}`,
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        detail: flow.detail,
      });
    }
  });
  return out.sort((a, b) => a.offsetMinutes - b.offsetMinutes);
}
