"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  InvoiceStatus,
  MockInvoice,
  SiteApprovalStage,
  SiteInvoiceAging,
} from "@/lib/mock/site-detail";
import Link from "next/link";
import { useContainerSize } from "@/lib/hooks/use-container-size";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { CheckCircle2, CircleAlert, CircleDashed, Filter, RotateCcw } from "lucide-react";

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; badge: "success" | "warning" | "danger" }> = {
  onTime: { label: "On Time", color: "hsl(142 71% 45%)", badge: "success" },
  atRisk: { label: "At Risk", color: "hsl(38 92% 50%)", badge: "warning" },
  overdue: { label: "Overdue", color: "hsl(0 84% 60%)", badge: "danger" },
};

const BUCKET_COLOR: Record<SiteInvoiceAging["bucket"], string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

type Props = {
  stages: SiteApprovalStage[];
  aging: SiteInvoiceAging[];
  invoices: MockInvoice[];
};

export function InvoiceStatusPanel({ stages, aging, invoices }: Props) {
  const [statusVisible, setStatusVisible] = useState<Record<InvoiceStatus, boolean>>({
    onTime: true,
    atRisk: true,
    overdue: true,
  });
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<SiteInvoiceAging["bucket"] | null>(null);
  const funnelSize = useContainerSize<HTMLDivElement>();
  const agingSize = useContainerSize<HTMLDivElement>();

  const totalInvoices = invoices.length;
  const settled = invoices.filter((i) => i.stage === "Payment").length;
  const overallProgress = totalInvoices === 0 ? 0 : (settled / totalInvoices) * 100;

  const totalOnTime = stages.reduce((s, x) => s + x.onTime, 0);
  const totalAtRisk = stages.reduce((s, x) => s + x.atRisk, 0);
  const totalOverdue = stages.reduce((s, x) => s + x.overdue, 0);
  const stageTotal = totalOnTime + totalAtRisk + totalOverdue;

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!statusVisible[inv.status]) return false;
      if (selectedStage && inv.stage !== selectedStage) return false;
      if (selectedBucket && inv.agingBucket !== selectedBucket) return false;
      return true;
    });
  }, [invoices, statusVisible, selectedStage, selectedBucket]);

  function resetSelection() {
    setSelectedStage(null);
    setSelectedBucket(null);
    setStatusVisible({ onTime: true, atRisk: true, overdue: true });
  }

  const hasSelection =
    selectedStage !== null ||
    selectedBucket !== null ||
    !statusVisible.onTime ||
    !statusVisible.atRisk ||
    !statusVisible.overdue;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>4 & 5. Status Invoice · Approval Funnel · Aging</CardTitle>
          <CardDescription>
            Klik stage atau bucket untuk filter tabel invoice. Toggle status di legend.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Progress Settled
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {settled} / {totalInvoices}
            </div>
          </div>
          <ProgressRing value={overallProgress} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3 w-3" />
            Status
          </span>
          {(Object.keys(STATUS_META) as InvoiceStatus[]).map((s) => {
            const meta = STATUS_META[s];
            const isOn = statusVisible[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusVisible((prev) => ({ ...prev, [s]: !prev[s] }))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                  isOn ? "border-input bg-background" : "border-input bg-muted text-muted-foreground",
                )}
                aria-pressed={isOn}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isOn ? meta.color : "hsl(215 16% 47%)" }}
                />
                {meta.label}
                <span className="tabular-nums text-muted-foreground">
                  ({s === "onTime" ? totalOnTime : s === "atRisk" ? totalAtRisk : totalOverdue})
                </span>
              </button>
            );
          })}
          {hasSelection && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7"
              onClick={resetSelection}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div ref={funnelSize.ref}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Approval Funnel · klik stage
            </div>
            <div className={cn(funnelSize.isSmall ? "h-56" : "h-64")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stages}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                  barCategoryGap={12}
                  onClick={(e) => {
                    const label = e?.activeLabel;
                    if (typeof label === "string") {
                      setSelectedStage((prev) => (prev === label ? null : label));
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: funnelSize.isSmall ? 9 : 10 }}
                    stroke="hsl(215 16% 47%)"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fontSize: funnelSize.isSmall ? 10 : 11 }}
                    stroke="hsl(215 16% 47%)"
                    tickLine={false}
                    axisLine={false}
                    width={funnelSize.isSmall ? 96 : 130}
                    interval={0}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                    iconType="circle"
                    verticalAlign="bottom"
                  />
                  {statusVisible.onTime && (
                    <Bar dataKey="onTime" stackId="a" fill={STATUS_META.onTime.color} name="On Time" />
                  )}
                  {statusVisible.atRisk && (
                    <Bar dataKey="atRisk" stackId="a" fill={STATUS_META.atRisk.color} name="At Risk" />
                  )}
                  {statusVisible.overdue && (
                    <Bar dataKey="overdue" stackId="a" fill={STATUS_META.overdue.color} name="Overdue" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {selectedStage && (
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1 text-xs">
                <span className="font-medium">Stage terpilih:</span>
                <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.5 text-[11px]">
                  {selectedStage}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStage(null)}
                  className="ml-auto text-[11px] text-primary hover:underline"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div ref={agingSize.ref}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Invoice Aging · klik bucket
            </div>
            <div className={cn(agingSize.isSmall ? "h-56" : "h-64")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aging}
                  margin={{ top: 16, right: 12, left: 8, bottom: 0 }}
                  barCategoryGap={agingSize.isSmall ? 12 : 20}
                  onClick={(e) => {
                    const label = e?.activeLabel as SiteInvoiceAging["bucket"] | undefined;
                    if (label) setSelectedBucket((prev) => (prev === label ? null : label));
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: agingSize.isSmall ? 10 : 11 }}
                    stroke="hsl(215 16% 47%)"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: agingSize.isSmall ? 9 : 10 }}
                    stroke="hsl(215 16% 47%)"
                    tickLine={false}
                    axisLine={false}
                    width={agingSize.isSmall ? 46 : 60}
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
                    formatter={(v: number, _n, item) => [
                      formatCurrency(v),
                      `Aging ${item.payload.bucket} · ${item.payload.count} invoice`,
                    ]}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {aging.map((d) => (
                      <Cell
                        key={d.bucket}
                        fill={BUCKET_COLOR[d.bucket]}
                        opacity={selectedBucket && selectedBucket !== d.bucket ? 0.35 : 1}
                        stroke={selectedBucket === d.bucket ? "hsl(215 16% 20%)" : undefined}
                        strokeWidth={selectedBucket === d.bucket ? 2 : 0}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="top"
                      formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v} inv` : "")}
                      style={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {selectedBucket && (
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1 text-xs">
                <span className="font-medium">Bucket terpilih:</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: BUCKET_COLOR[selectedBucket], color: "white" }}
                >
                  {selectedBucket}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBucket(null)}
                  className="ml-auto text-[11px] text-primary hover:underline"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>

        <InvoiceDrilldownTable
          invoices={filteredInvoices}
          totalCount={invoices.length}
          selectedStage={selectedStage}
          selectedBucket={selectedBucket}
        />
      </CardContent>
    </Card>
  );
}

function InvoiceDrilldownTable({
  invoices,
  totalCount,
  selectedStage,
  selectedBucket,
}: {
  invoices: MockInvoice[];
  totalCount: number;
  selectedStage: string | null;
  selectedBucket: SiteInvoiceAging["bucket"] | null;
}) {
  const shown = invoices.slice(0, 6);
  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Invoice terpengaruh
        </div>
        <div className="text-[11px] text-muted-foreground">
          Menampilkan {shown.length} dari{" "}
          <b className="text-foreground">{formatNumber(invoices.length)}</b> invoice
          {invoices.length !== totalCount && (
            <> (dari total {formatNumber(totalCount)} pada site ini)</>
          )}
          {selectedStage && ` · stage ${selectedStage}`}
          {selectedBucket && ` · bucket ${selectedBucket}`}
        </div>
      </div>
      {invoices.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Tidak ada invoice yang cocok dengan filter aktif.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-right font-medium">Nilai</th>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Aging</th>
                <th className="px-3 py-2 text-left font-medium">Due</th>
                <th className="px-3 py-2 text-left font-medium">PIC</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv) => {
                const meta = STATUS_META[inv.status];
                const Icon =
                  inv.status === "onTime" ? CheckCircle2 : inv.status === "atRisk" ? CircleAlert : CircleDashed;
                return (
                  <tr key={inv.number} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium tabular-nums">
                      <Link href={invoiceHref(inv.number)} className="text-primary hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(inv.amount)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{inv.stage}</td>
                    <td className="px-3 py-2">
                      <Badge variant={meta.badge} className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: BUCKET_COLOR[inv.agingBucket] }}
                      >
                        {inv.agingBucket}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{inv.dueDate}</td>
                    <td className="px-3 py-2 text-muted-foreground">{inv.pic}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  const color =
    value >= 80 ? "hsl(142 71% 45%)" : value >= 50 ? "hsl(199 89% 48%)" : "hsl(38 92% 50%)";
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(214 32% 91%)" strokeWidth={6} />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {value.toFixed(0)}%
      </div>
    </div>
  );
}
