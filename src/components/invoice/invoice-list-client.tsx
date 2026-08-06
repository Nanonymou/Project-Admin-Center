"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, CheckCircle2, Clock, FileText, Info, MapPin, Pencil, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
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
import { getTaxConfig } from "@/lib/mock/tax-config";
import { Button } from "@/components/ui/button";
import { InvoiceForm, type InvoiceComputed, type InvoiceFormValue } from "@/components/invoice/invoice-form";
import { cn, formatCurrency } from "@/lib/utils";

const SETTLEMENT_META: Record<
  InvoiceSettlement,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  settled: { label: "Lunas", variant: "success" },
  outstanding: { label: "Outstanding", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
};

const STAGE_ORDER = ["Verifikasi Site", "Approval Leader", "Verifikasi Finance", "Kirim Client", "Payment"];

const STATUS_CARDS: {
  key: InvoiceSettlement | "all";
  label: string;
  icon: typeof FileText;
  tone: string;
}[] = [
  { key: "all", label: "Semua", icon: FileText, tone: "text-primary bg-primary/10" },
  { key: "settled", label: "Lunas", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
  { key: "outstanding", label: "Outstanding", icon: Clock, tone: "text-amber-700 bg-amber-50" },
  { key: "overdue", label: "Overdue", icon: Wallet, tone: "text-rose-700 bg-rose-50" },
];

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

  const baseInvoices = useMemo(
    () => buildInvoiceListFor(filteredSites, SITE_DETAILS),
    [filteredSites],
  );

  // Session-created invoices and edits applied to existing ones (mock — no
  // backend yet). Merged into the base feed for display.
  const [addedItems, setAddedItems] = useState<InvoiceListItem[]>([]);
  const [edits, setEdits] = useState<Record<string, InvoiceListItem>>({});

  const allInvoices = useMemo(
    () => [...addedItems, ...baseInvoices].map((i) => edits[i.id] ?? i),
    [addedItems, baseInvoices, edits],
  );

  // On-page project filter — chips derived from the invoices in scope.
  const [activeProject, setActiveProject] = useState<string | "all">("all");
  const projectChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of allInvoices) map.set(inv.projectCode, (map.get(inv.projectCode) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [allInvoices]);

  useEffect(() => {
    if (activeProject !== "all" && !projectChips.some((p) => p.code === activeProject)) {
      setActiveProject("all");
    }
  }, [projectChips, activeProject]);

  const projectFiltered = useMemo(
    () => (activeProject === "all" ? allInvoices : allInvoices.filter((i) => i.projectCode === activeProject)),
    [allInvoices, activeProject],
  );

  // On-page multi-select location filter — chips derived from the locations in
  // scope, so it adapts to any project's sites (no hard-coded locations).
  // Empty selection means "all locations".
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const locationChips = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const inv of projectFiltered) {
      const entry = map.get(inv.locationId) ?? { id: inv.locationId, name: inv.locationName, count: 0 };
      entry.count += 1;
      map.set(inv.locationId, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectFiltered]);

  function toggleLocation(id: string) {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Drop any selected location that has left the current scope.
  useEffect(() => {
    setSelectedLocations((prev) => {
      const valid = new Set(locationChips.map((c) => c.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [locationChips]);

  const locationFiltered = useMemo(
    () =>
      selectedLocations.size === 0
        ? projectFiltered
        : projectFiltered.filter((i) => selectedLocations.has(i.locationId)),
    [projectFiltered, selectedLocations],
  );

  // Status filter driven by the clickable status cards.
  const [settlementFilter, setSettlementFilter] = useState<InvoiceSettlement | "all">("all");
  const statusSummary = useMemo(() => summarizeInvoiceList(locationFiltered), [locationFiltered]);

  const invoices = useMemo(
    () =>
      settlementFilter === "all"
        ? locationFiltered
        : locationFiltered.filter((i) => i.settlement === settlementFilter),
    [locationFiltered, settlementFilter],
  );
  const summary = useMemo(() => summarizeInvoiceList(invoices), [invoices]);

  // Per-stage recap for the summary card (counts + amount by approval stage).
  const stageSummary = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const inv of locationFiltered) {
      const entry = map.get(inv.stage) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += inv.amount;
      map.set(inv.stage, entry);
    }
    return STAGE_ORDER.filter((s) => map.has(s)).map((s) => ({ stage: s, ...map.get(s)! }));
  }, [locationFiltered]);

  // Invoice creation is allowed for site/leader/super admin (PRD: "Membuat Invoice").
  const canManage =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const siteOptions = useMemo(
    () => scopedSites.map((s) => ({ locationId: s.locationId, locationName: s.locationName, projectCode: s.projectCode })),
    [scopedSites],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<InvoiceFormValue | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<InvoiceListItem | null>(null);

  function openAdd() {
    setFormMode("add");
    setFormInitial(undefined);
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: InvoiceListItem) {
    const rate = getTaxConfig(item.projectCode).rate;
    const subtotal = Math.round(item.amount / (1 + rate));
    setFormMode("edit");
    setEditingItem(item);
    setFormInitial({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      projectCode: item.projectCode,
      locationId: item.locationId,
      locationName: item.locationName,
      pic: item.pic,
      dueDate: "",
      lines: [{ id: "l1", description: `Tagihan ${item.projectCode} · ${item.locationName}`, qty: 1, unitPrice: subtotal }],
    });
    setFormOpen(true);
  }

  function generateNumber(projectCode: string): string {
    const now = new Date();
    const seq = String(now.getTime()).slice(-4);
    return `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${projectCode}/${seq}`;
  }

  function handleSubmit(value: InvoiceFormValue, computed: InvoiceComputed) {
    const dueDate = value.dueDate
      ? new Date(value.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : editingItem?.dueDate ?? "—";
    const item: InvoiceListItem = {
      id: value.id ?? `session-${Date.now()}`,
      invoiceNumber: value.invoiceNumber ?? generateNumber(value.projectCode),
      amount: computed.net,
      projectCode: value.projectCode,
      locationId: value.locationId,
      locationName: value.locationName,
      stage: editingItem?.stage ?? "Verifikasi Site",
      status: editingItem?.status ?? "onTime",
      settlement: editingItem?.settlement ?? "outstanding",
      agingBucket: editingItem?.agingBucket ?? "0-30",
      dueDate,
      pic: value.pic,
    };
    if (formMode === "add") {
      setAddedItems((prev) => [item, ...prev]);
    } else if (item.id.startsWith("session-")) {
      setAddedItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    } else {
      setEdits((prev) => ({ ...prev, [item.id]: item }));
    }
    setFormOpen(false);
  }

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
        actions={
          <>
            <ActivePeriodBadge />
            {canManage && (
              <Button size="sm" onClick={openAdd} disabled={siteOptions.length === 0}>
                <Plus className="h-4 w-4" />
                Tambah Invoice
              </Button>
            )}
          </>
        }
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

        {projectChips.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
            <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Project
            </span>
            <button
              type="button"
              onClick={() => setActiveProject("all")}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                activeProject === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              Semua · {allInvoices.length}
            </button>
            {projectChips.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setActiveProject(p.code)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  activeProject === p.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {p.code} · {p.count}
              </button>
            ))}
          </div>
        )}

        {locationChips.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
            <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Lokasi
            </span>
            <button
              type="button"
              onClick={() => setSelectedLocations(new Set())}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                selectedLocations.size === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              Semua · {projectFiltered.length}
            </button>
            {locationChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleLocation(c.id)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  selectedLocations.has(c.id)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {c.name} · {c.count}
              </button>
            ))}
            {selectedLocations.size > 0 && (
              <span className="ml-1 text-[11px] text-muted-foreground">
                {selectedLocations.size} lokasi dipilih
              </span>
            )}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATUS_CARDS.map((card) => {
            const data =
              card.key === "all"
                ? { count: statusSummary.totalCount, amount: statusSummary.totalAmount }
                : statusSummary.bySettlement[card.key];
            const active = settlementFilter === card.key;
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setSettlementFilter(card.key)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors hover:bg-accent/40",
                  active ? "border-primary ring-1 ring-primary" : "border-border",
                )}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </span>
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded", card.tone)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-1.5 truncate text-lg font-semibold tabular-nums">
                  {formatCurrency(data.amount)}
                </div>
                <div className="text-[11px] text-muted-foreground">{data.count} invoice</div>
              </button>
            );
          })}
        </section>

        {stageSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan per Stage</CardTitle>
              <CardDescription>
                Distribusi invoice pada tiap tahap approval{selectedLocations.size > 0 ? " (lokasi terpilih)" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stageSummary.map((s) => {
                  const pct = statusSummary.totalAmount > 0 ? (s.amount / statusSummary.totalAmount) * 100 : 0;
                  return (
                    <div key={s.stage} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 truncate text-xs font-medium">{s.stage}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {s.count}
                      </div>
                      <div className="w-28 shrink-0 text-right text-xs tabular-nums font-medium">
                        {formatCurrency(s.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Daftar Invoice</CardTitle>
            <CardDescription>
              {summary.totalCount} invoice dari {filteredSites.length} site aktif
              {settlementFilter !== "all" ? ` · status ${SETTLEMENT_META[settlementFilter].label}` : ""}.
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
                          <div className="inline-flex items-center gap-3">
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            )}
                            <Link
                              href={invoiceHref(item.invoiceNumber)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Detail
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
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

      <InvoiceForm
        open={formOpen}
        mode={formMode}
        sites={siteOptions}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
