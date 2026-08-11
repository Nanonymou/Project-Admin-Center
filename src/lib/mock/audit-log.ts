/**
 * Audit Log (config-driven mock) — the system/security audit trail, distinct
 * from the operational Activity Log. Records administrative and configuration
 * events (role changes, master lock/unlock, parameter & pricing edits, tax and
 * invoice-type changes, user management) with the actor and a category, so
 * privileged actions can be reviewed. Frontend-first: this seeds a deterministic
 * trail until the audit_logs API is wired to the page. Leader/Super Admin only.
 */

export type AuditCategory = "role" | "master_lock" | "parameter" | "pricing" | "tax" | "user" | "formula";

export type SystemAuditEntry = {
  id: string;
  category: AuditCategory;
  action: string;
  actor: string;
  role: string;
  target: string;
  detail: string;
  /** Previous value for an update (null for create/lock/activate events). */
  before: string | null;
  /** New value for a create/update (null for pure state toggles). */
  after: string | null;
  at: string; // ISO
  relative: string;
};

export const AUDIT_CATEGORY_META: Record<
  AuditCategory,
  { label: string; variant: "info" | "success" | "warning" | "danger" | "muted" }
> = {
  role: { label: "Role", variant: "info" },
  master_lock: { label: "Master Lock", variant: "danger" },
  parameter: { label: "Parameter", variant: "warning" },
  pricing: { label: "Pricing", variant: "success" },
  tax: { label: "Pajak", variant: "warning" },
  user: { label: "Pengguna", variant: "info" },
  formula: { label: "Formula", variant: "muted" },
};

const TEMPLATE: {
  category: AuditCategory;
  action: string;
  actor: string;
  role: string;
  target: string;
  detail: string;
  before: string | null;
  after: string | null;
}[] = [
  { category: "role", action: "role.update", actor: "Andi Prasetya", role: "Super Admin", target: "Site Admin", detail: "Matriks izin role Site Admin diperbarui — akses Invoice ditambah.", before: "invoice: [view]", after: "invoice: [view, create, edit]" },
  { category: "master_lock", action: "master.lock", actor: "Andi Prasetya", role: "Super Admin", target: "Formula Engine", detail: "Domain Formula Engine dikunci untuk penutupan periode.", before: "unlocked", after: "locked" },
  { category: "parameter", action: "parameter.update", actor: "Randi Setiawan", role: "Leader Admin", target: "session_timeout_min", detail: "Batas sesi idle diubah 30 → 20 menit.", before: "30 menit", after: "20 menit" },
  { category: "pricing", action: "pricing.set", actor: "Randi Setiawan", role: "Leader Admin", target: "Meals Buffet · KM22", detail: "Harga meals disesuaikan efektif periode berjalan.", before: "Rp 42.000", after: "Rp 45.000" },
  { category: "tax", action: "tax.activate_project", actor: "Andi Prasetya", role: "Super Admin", target: "PHKT", detail: "Profil pajak PB1 10% diaktifkan untuk PHKT.", before: null, after: "PB1 10%" },
  { category: "user", action: "user.create", actor: "Randi Setiawan", role: "Leader Admin", target: "admin.mutiara@tpb.co.id", detail: "User baru ditambahkan dengan role Site Admin.", before: null, after: "role: site_admin, status: invited" },
  { category: "formula", action: "formula_parameter.update", actor: "Andi Prasetya", role: "Super Admin", target: "penalty_monthly_rate", detail: "Denda per bulan diubah 2% → 1.5%.", before: "2%", after: "1.5%" },
  { category: "master_lock", action: "master.unlock", actor: "Andi Prasetya", role: "Super Admin", target: "Master Timeframe", detail: "Domain Master Timeframe dibuka untuk revisi workflow.", before: "locked", after: "unlocked" },
  { category: "role", action: "role.deactivate", actor: "Andi Prasetya", role: "Super Admin", target: "Auditor (custom)", detail: "Role custom Auditor dinonaktifkan.", before: "active", after: "inactive" },
];

function isoDaysAgo(days: number, hour: number, min: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function relativeOf(days: number): string {
  if (days === 0) return "hari ini";
  if (days === 1) return "kemarin";
  return `${days} hari lalu`;
}

/**
 * Build the seeded system audit trail, newest first. Deterministic so the page
 * renders a stable trail across reloads.
 */
export function buildSystemAuditLog(): SystemAuditEntry[] {
  return TEMPLATE.map((t, i) => {
    const days = i * 2 + (i % 3);
    return {
      id: `audit-${i}`,
      category: t.category,
      action: t.action,
      actor: t.actor,
      role: t.role,
      target: t.target,
      detail: t.detail,
      before: t.before,
      after: t.after,
      at: isoDaysAgo(days, 9 + (i % 8), (i * 13) % 60),
      relative: relativeOf(days),
    };
  }).sort((a, b) => b.at.localeCompare(a.at));
}
