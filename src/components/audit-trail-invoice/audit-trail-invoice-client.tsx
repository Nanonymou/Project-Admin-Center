"use client";

import { useMemo, useState } from "react";
import { History, MapPin, FileText, CheckCircle2, Send, Eye, Lock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

type AuditAction = "create" | "review" | "approve" | "send" | "upload" | "lock";

const ACTION_META: Record<AuditAction, { label: string; badge: "default" | "info" | "warning" | "success"; icon: typeof FileText }> = {
  create: { label: "Dibuat", badge: "default", icon: FileText },
  review: { label: "Review", badge: "warning", icon: Eye },
  approve: { label: "Approve", badge: "success", icon: CheckCircle2 },
  send: { label: "Kirim", badge: "info", icon: Send },
  upload: { label: "Upload", badge: "info", icon: FileText },
  lock: { label: "Lock", badge: "success", icon: Lock },
};

/** Invoice approval flow → who acts and what the audit line reads. */
const FLOW: { action: AuditAction; actor: string; role: string; detail: string }[] = [
  { action: "create", actor: "Site Admin", role: "Site Admin", detail: "Invoice dibuat dari Daily Sales yang disetujui." },
  { action: "upload", actor: "Site Admin", role: "Site Admin", detail: "Dokumen pendukung (PO, timesheet) diunggah." },
  { action: "review", actor: "Site Admin", role: "Site Admin", detail: "Kuantitas & dokumen diverifikasi di site." },
  { action: "approve", actor: "Leader Admin", role: "Leader Admin", detail: "Disetujui Leader Admin." },
  { action: "review", actor: "Finance", role: "Finance", detail: "Diverifikasi Finance — nominal & pajak dicek." },
  { action: "send", actor: "Finance", role: "Finance", detail: "Invoice dikirim ke client." },
  { action: "approve", actor: "Finance", role: "Finance", detail: "Pembayaran diterima — invoice lunas." },
];

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/**
 * Audit Trail Invoice — a chronological, append-only trail of every action taken
 * on an invoice (create → upload → verify → approve → send → payment), seeded per
 * workspace. Shows who did what, in which role, and when. Persona-scoped; no
 * backend required.
 */
export function AuditTrailInvoiceClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const trail = useMemo(() => {
    if (!ws) return [];
    const seed = seedOf(ws.locationId);
    // Only show the flow up to the invoice's current progress.
    const progressed = 3 + (seed % (FLOW.length - 2)); // 3..FLOW.length
    const base = Date.now() - (progressed + 1) * 20 * 3_600_000;
    return FLOW.slice(0, progressed).map((f, i) => {
      const t = new Date(base + i * 20 * 3_600_000);
      return {
        ...f,
        id: `audit-${ws.locationId}-${i}`,
        at: t.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      };
    });
  }, [ws]);

  if (!ws) {
    return (
      <div>
        <PageHeader title="Audit Trail Invoice" description="Jejak audit invoice." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada invoice dalam cakupan Anda.</div>
      </div>
    );
  }

  const seed = seedOf(ws.locationId);
  const invoiceNo = `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}`;
  const amount = 80_000_000 + (seed % 40) * 1_000_000;

  const actionsPresent = Array.from(new Set(trail.map((e) => e.action)));
  const visibleTrail = actionFilter === "all" ? trail : trail.filter((e) => e.action === actionFilter);

  return (
    <div>
      <PageHeader
        title="Audit Trail Invoice"
        description={`Jejak audit lengkap invoice · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Audit Trail Invoice" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm">
            <span className="text-muted-foreground">{invoiceNo}</span> ·{" "}
            <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
          </span>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                {visibleTrail.length} dari {trail.length} kejadian pada invoice ini.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(["all", ...actionsPresent] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActionFilter(a)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    actionFilter === a
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {a === "all" ? "Semua" : ACTION_META[a].label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 pl-6">
              {visibleTrail.map((e, i) => {
                const meta = ACTION_META[e.action];
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    </span>
                    {i < visibleTrail.length - 1 && (
                      <span className="absolute -left-[18px] top-4 h-full w-px bg-border" aria-hidden />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.badge} className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                      <span className="text-sm font-medium">{e.actor}</span>
                      <span className="text-[11px] text-muted-foreground">({e.role})</span>
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{e.at}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
