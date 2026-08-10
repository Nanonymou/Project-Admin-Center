"use client";

import { useMemo, useState } from "react";
import { FileText, CalendarClock, UserCircle, MapPin, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories } from "@/lib/mock/pricing-config";
import { computeInvoice } from "@/lib/server/services/invoice-calculation-service";
import { getBbmConfig } from "@/lib/mock/bbm-config";

const STATUS_META: Record<string, { label: string; badge: "info" | "warning" | "success" | "danger" }> = {
  outstanding: { label: "Outstanding", badge: "warning" },
  sent: { label: "Terkirim", badge: "info" },
  settled: { label: "Lunas", badge: "success" },
  overdue: { label: "Jatuh Tempo", badge: "danger" },
};

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/**
 * Detail Invoice page — full invoice view seeded from config-driven mock data:
 * header (number, project, site, due date, PIC, status/aging), line items from
 * the priced service categories, and the config-aware total (PPN/PB1, BBM,
 * penalty). Persona-scoped; no backend required.
 */
export function DetailInvoiceClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const detail = useMemo(() => {
    if (!ws) return null;
    const seed = seedOf(ws.locationId);
    const cats = getPricedCategories(ws.projectCode, ws.locationId).filter((c) => !c.deduction).slice(0, 5);
    const lines = cats.map((c, i) => {
      const qty = 40 + ((seed + i * 13) % 120);
      return { label: c.label, unit: c.unit, qty, price: c.price, amount: qty * c.price };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const deduction = (seed % 4) * 1_000_000;
    const bbm = getBbmConfig(ws.projectCode).applies ? 5_000_000 + (seed % 6) * 500_000 : 0;
    const overdueDays = (seed % 3) * 25;
    const calc = computeInvoice({ projectCode: ws.projectCode, subtotal, deduction, bbm, overdueDays });
    const statuses = ["outstanding", "sent", "settled", "overdue"] as const;
    const status = statuses[seed % statuses.length];
    const due = new Date();
    due.setDate(due.getDate() + 30 - overdueDays);
    return {
      number: `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}`,
      pic: ["Bagas Wicaksono", "Ika Rahmawati", "Fajar Nugraha", "Dinda Ayu"][seed % 4],
      dueDate: due.toISOString().slice(0, 10),
      status,
      lines,
      calc,
      overdueDays,
    };
  }, [ws, wsIndex]);

  if (!ws || !detail) {
    return (
      <div>
        <PageHeader title="Detail Invoice" description="Rincian lengkap invoice." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada invoice dalam cakupan Anda.</div>
      </div>
    );
  }

  const meta = STATUS_META[detail.status];

  return (
    <div>
      <PageHeader
        title={detail.number}
        description={`Detail invoice · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Detail Invoice" }]}
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
        </div>

        {/* Meta cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetaCard icon={FileText} label="Nilai Invoice" value={formatCurrency(detail.calc.total)} />
          <MetaCard icon={CalendarClock} label="Jatuh Tempo" value={formatDate(detail.dueDate)} />
          <MetaCard icon={UserCircle} label="PIC" value={detail.pic} />
          <Card>
            <CardContent className="py-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
              <Badge variant={meta.badge} className="mt-1">
                {meta.label}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Line items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Rincian Item
            </CardTitle>
            <CardDescription>{detail.lines.length} item jasa.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.label} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        {l.label}
                        <span className="ml-1 text-[11px] text-muted-foreground">/ {l.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(l.price)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="px-3 py-2 font-medium" colSpan={3}>
                      Subtotal
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(detail.calc.subtotal)}
                    </td>
                  </tr>
                  {detail.calc.deduction > 0 && (
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                        Pengurang
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                        −{formatCurrency(detail.calc.deduction)}
                      </td>
                    </tr>
                  )}
                  {detail.calc.bbmAmount > 0 && (
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                        BBM surcharge
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(detail.calc.bbmAmount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                      {detail.calc.taxLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(detail.calc.taxAmount)}</td>
                  </tr>
                  {detail.calc.penaltyAmount > 0 && (
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                        Penalty ({detail.calc.penaltyMonths} bln)
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                        {formatCurrency(detail.calc.penaltyAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 bg-primary/5">
                    <td className="px-3 py-3 text-base font-semibold" colSpan={3}>
                      Total
                    </td>
                    <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-primary">
                      {formatCurrency(detail.calc.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-sm font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
