import type { MockInvoice } from "./site-detail";
import type { AuditAction } from "./audit-trail";

export type InvoiceAuditEntry = {
  id: string;
  action: AuditAction;
  actor: string;
  role: string;
  timeLabel: string;
  offsetHours: number;
  detail: string;
};

/** Stage → who acted + what the audit line reads. Project-agnostic. */
const STAGE_FLOW = ["Verifikasi Site", "Approval Leader", "Verifikasi Finance", "Kirim Client", "Payment"];

const STAGE_STEP: Record<string, { action: AuditAction; actor: string; role: string; detail: string }> = {
  "Verifikasi Site": { action: "review", actor: "Site Admin", role: "Site Admin", detail: "Kuantitas & dokumen diverifikasi di site." },
  "Approval Leader": { action: "approve", actor: "Leader Admin", role: "Leader Admin", detail: "Disetujui Leader Admin." },
  "Verifikasi Finance": { action: "review", actor: "Finance", role: "Finance", detail: "Diverifikasi Finance — nominal & pajak dicek." },
  "Kirim Client": { action: "send", actor: "Finance", role: "Finance", detail: "Invoice dikirim ke client." },
  "Payment": { action: "approve", actor: "Finance", role: "Finance", detail: "Pembayaran diterima — invoice lunas." },
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function timeLabel(hours: number): string {
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

/**
 * Build a deterministic audit trail for a single invoice: creation, upload,
 * submit, then one entry per approval stage already reached. Nothing is keyed
 * to a specific project — the same flow serves every site's invoices.
 */
export function buildInvoiceAuditTrail(invoice: MockInvoice): InvoiceAuditEntry[] {
  const seed = seedOf(invoice.number);
  const stageIndex = Math.max(0, STAGE_FLOW.indexOf(invoice.stage));
  const gap = 6 + (seed % 30); // hours between events

  const base: { action: AuditAction; actor: string; role: string; detail: string }[] = [
    { action: "create", actor: invoice.pic, role: "Site Admin", detail: `Invoice ${invoice.number} dibuat.` },
    { action: "upload", actor: invoice.pic, role: "Site Admin", detail: "Berita acara & rekap kuantitas dilampirkan." },
    { action: "submit", actor: invoice.pic, role: "Site Admin", detail: "Invoice disubmit untuk approval." },
  ];

  // Include the stage steps up to and including the current stage.
  const stageSteps = STAGE_FLOW.slice(0, stageIndex + 1)
    .map((s) => STAGE_STEP[s])
    .filter(Boolean);

  const flow = [...base, ...stageSteps];
  const total = flow.length;

  return flow.map((step, i) => {
    const offsetHours = (total - i) * gap;
    return {
      id: `${invoice.number}-audit-${i}`,
      action: step.action,
      actor: step.actor,
      role: step.role,
      timeLabel: timeLabel(offsetHours),
      offsetHours,
      detail: step.detail,
    };
  });
}
