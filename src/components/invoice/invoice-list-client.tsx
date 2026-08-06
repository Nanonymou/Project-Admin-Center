"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Clock, FileText, Info, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import {
  buildInvoiceListFor,
  summarizeInvoiceList,
  type InvoiceListItem,
  type InvoiceSettlement,
} from "@/lib/mock/invoice-list";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { formatCurrency } from "@/lib/utils";

const SETTLEMENT_META: Record<
  InvoiceSettlement,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  settled: { label: "Lunas", variant: "success" },
  outstanding: { label: "Outstanding", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
};

export function InvoiceListClient() {
  const { persona } = usePersona();
  const { filters, setFilters } = useGlobalFilters();
  const router = useRouter();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => scopedSites.some((s) => s.projectCode === p.code)),
    [scopedSites],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => scopedSites.some((s) => s.locationId === l.id)),
    [scopedSites],
  );

  useEffect(() => {
    const validProjects = new Set(personaProjectOptions.map((p) => p.code));
    const validLocations = new Set(personaLocationOptions.map((l) => l.id));
    const nextProjects = filters.projects.filter((p) => validProjects.has(p));
    const nextLocations = filters.locations.filter((l) => validLocations.has(l));
    if (
      nextProjects.length !== filters.projects.length ||
      nextLocations.length !== filters.locations.length
    ) {
      setFilters({ ...filters, projects: nextProjects, locations: nextLocations });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProjectOptions, personaLocationOptions]);

  const selectedLocationIds = useMemo(() => new Set(filters.locations), [filters.locations]);

  const filteredSites = useMemo(() => {
    return scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
  }, [scopedSites, filters.projects, filters.locations, selectedLocationIds]);

  const invoices = useMemo(
    () => buildInvoiceListFor(filteredSites, SITE_DETAILS),
    [filteredSites],
  );
  const summary = useMemo(() => summarizeInvoiceList(invoices), [invoices]);

  function navigateFromRow(e: React.MouseEvent, item: InvoiceListItem) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    router.push(invoiceHref(item.invoiceNumber));
  }

  return (
    <div>
      <PageHeader
        title="Monitoring Invoice"
        description="Daftar seluruh invoice per site — status penagihan, stage approval, dan drill ke detail."
        breadcrumbs={[{ label: "Operasional" }, { label: "Invoice" }]}
        actions={<ActivePeriodBadge />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Daftar invoice mengikuti filter global project & lokasi. Status penagihan dihitung dari
            stage approval dan aging — sama untuk semua project.
          </span>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Invoice" value={summary.totalAmount} format="currency" icon={FileText} tone="primary" />
          <KpiCard label="Lunas" value={summary.bySettlement.settled.amount} format="currency" icon={CheckCircle2} tone="success" />
          <KpiCard label="Outstanding" value={summary.bySettlement.outstanding.amount} format="currency" icon={Clock} tone="warning" />
          <KpiCard label="Overdue" value={summary.bySettlement.overdue.amount} format="currency" icon={Wallet} tone="danger" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Invoice</CardTitle>
            <CardDescription>
              {summary.totalCount} invoice dari {filteredSites.length} site aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Stage</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Due</th>
                    <th className="px-3 py-2 text-left font-medium">PIC</th>
                    <th className="px-3 py-2 text-right font-medium">Nilai</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Tidak ada invoice pada scope & filter ini.
                      </td>
                    </tr>
                  )}
                  {invoices.map((item) => {
                    const meta = SETTLEMENT_META[item.settlement];
                    return (
                      <tr
                        key={item.id}
                        onClick={(e) => navigateFromRow(e, item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") router.push(invoiceHref(item.invoiceNumber));
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Buka detail ${item.invoiceNumber}`}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/40 focus:outline-none"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={invoiceHref(item.invoiceNumber)}
                            className="text-sm font-medium tabular-nums text-primary hover:underline"
                          >
                            {item.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div className="text-sm">{item.locationName}</div>
                          <div className="text-[11px]">{item.projectCode}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.stage}</td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.dueDate}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.pic}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={invoiceHref(item.invoiceNumber)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Detail
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {invoices.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/30 text-sm font-medium">
                      <td colSpan={6} className="px-3 py-2">
                        Total ({summary.totalCount} invoice)
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(summary.totalAmount)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
