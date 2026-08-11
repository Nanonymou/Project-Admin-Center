"use client";

import { useMemo, useState } from "react";
import { CalendarDays, AlarmClock, CalendarClock, AlertTriangle, CheckCircle2, Receipt, BadgeCheck, Send, Upload } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { DeadlineCalendar, isInvoiceDeadline } from "@/components/calendar/deadline-calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines, STATUS_META } from "@/lib/mock/deadlines";

/**
 * Dashboard Calendar — a month calendar of the key deadlines (closing, invoice
 * submit, approval, payment, audit) across the sites a persona can see, with
 * summary tiles and an upcoming‑events list. Reuses the shared DeadlineCalendar
 * grid. Persona‑scoped, frontend‑first (mock `deadlines`), no backend required.
 */
export function DashboardCalendarClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const allDeadlines = useMemo(() => buildDeadlines(scopedSites), [scopedSites]);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const deadlines = useMemo(
    () => (invoiceOnly ? allDeadlines.filter((d) => isInvoiceDeadline(d.kind)) : allDeadlines),
    [allDeadlines, invoiceOnly],
  );
  const invoiceCount = useMemo(() => allDeadlines.filter((d) => isInvoiceDeadline(d.kind)).length, [allDeadlines]);

  const summary = useMemo(() => {
    const overdue = deadlines.filter((d) => d.status === "overdue").length;
    const dueToday = deadlines.filter((d) => d.status === "due_today").length;
    const dueSoon = deadlines.filter((d) => d.status === "due_soon").length;
    const settled = deadlines.filter((d) => d.status === "settled").length;
    return { overdue, dueToday, dueSoon, settled };
  }, [deadlines]);

  const upcoming = useMemo(
    () =>
      [...deadlines]
        .filter((d) => d.status !== "settled")
        .sort((a, b) => a.daysRelative - b.daysRelative)
        .slice(0, 8),
    [deadlines],
  );

  // Estimated invoice value per site (monthly sales), used to total invoice
  // deadlines falling on a picked date.
  const salesByLocation = useMemo(
    () => new Map(scopedSites.map((s) => [s.locationId, s.sales])),
    [scopedSites],
  );

  // Approvals falling due today — surfaced prominently so a Leader doesn't miss
  // them. Uses the approval-kind deadlines with a due-today status.
  const approvalsDueToday = useMemo(
    () => allDeadlines.filter((d) => d.kind === "approval" && d.status === "due_today"),
    [allDeadlines],
  );

  // Overdue approvals — sorted by how many days late, most overdue first.
  const approvalsOverdue = useMemo(
    () =>
      allDeadlines
        .filter((d) => d.kind === "approval" && d.status === "overdue")
        .sort((a, b) => a.daysRelative - b.daysRelative),
    [allDeadlines],
  );

  // Document-delivery reminders — deadlines that require sending documents to a
  // counterparty (invoice submission to client, audit support docs), upcoming
  // first. Distinct from internal approvals.
  const documentDeliveries = useMemo(
    () =>
      allDeadlines
        .filter((d) => (d.kind === "invoice_submit" || d.kind === "audit") && d.status !== "settled")
        .sort((a, b) => a.daysRelative - b.daysRelative),
    [allDeadlines],
  );

  // Invoice upload reminders — invoice-submit deadlines whose supporting-document
  // upload is not yet complete, most urgent (soonest, least ready) first.
  const uploadReminders = useMemo(
    () =>
      allDeadlines
        .filter((d) => d.kind === "invoice_submit" && d.status !== "settled" && d.progressPct < 100)
        .sort((a, b) => a.daysRelative - b.daysRelative || a.progressPct - b.progressPct),
    [allDeadlines],
  );

  // Invoice deadlines falling within the next 7 days, with an estimated total.
  const invoiceThisWeek = useMemo(() => {
    const items = allDeadlines
      .filter((d) => isInvoiceDeadline(d.kind) && d.daysRelative >= 0 && d.daysRelative <= 7)
      .sort((a, b) => a.daysRelative - b.daysRelative);
    const total = items.reduce((sum, d) => sum + (salesByLocation.get(d.locationId) ?? 0), 0);
    return { items, total };
  }, [allDeadlines, salesByLocation]);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const dateDetail = useMemo(() => {
    if (!selectedDate) return null;
    const onDate = allDeadlines.filter((d) => d.dueDate.slice(0, 10) === selectedDate);
    const invoiceItems = onDate.filter((d) => isInvoiceDeadline(d.kind));
    const invoiceTotal = invoiceItems.reduce((sum, d) => sum + (salesByLocation.get(d.locationId) ?? 0), 0);
    return { onDate, invoiceItems, invoiceTotal };
  }, [selectedDate, allDeadlines, salesByLocation]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Calendar"
        description="Kalender tenggat closing, invoice, approval, dan pembayaran untuk site dalam cakupan Anda."
      />
      <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile icon={AlertTriangle} label="Terlambat" value={summary.overdue} tone="danger" />
        <SummaryTile icon={AlarmClock} label="Jatuh tempo hari ini" value={summary.dueToday} tone="danger" />
        <SummaryTile icon={CalendarClock} label="≤ 3 hari" value={summary.dueSoon} tone="warning" />
        <SummaryTile icon={CheckCircle2} label="Selesai" value={summary.settled} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-violet-600" />
            Reminder Upload Invoice
          </CardTitle>
          <CardDescription>Invoice yang dokumen pendukungnya belum lengkap diunggah, diurut paling mendesak.</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadReminders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Semua dokumen invoice sudah terunggah. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {uploadReminders.map((d) => (
                <li key={d.id} className="rounded-md border border-violet-200 bg-violet-50 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Upload className="h-4 w-4 shrink-0 text-violet-600" />
                    <span className="font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.locationName} · {d.projectCode}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{d.dueLabel}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.max(0, Math.min(100, d.progressPct))}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-medium text-violet-700">{d.progressPct}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" />
            Reminder Pengiriman Dokumen
          </CardTitle>
          <CardDescription>Tenggat pengiriman dokumen ke pihak eksternal (invoice ke client, dukungan audit).</CardDescription>
        </CardHeader>
        <CardContent>
          {documentDeliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada pengiriman dokumen terjadwal.</p>
          ) : (
            <ul className="space-y-2">
              {documentDeliveries.map((d) => {
                const meta = STATUS_META[d.status];
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-2.5 text-sm"
                  >
                    <Send className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.locationName} · {d.projectCode} · PIC {d.owner}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{d.dueLabel}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-sky-600" />
            Invoice Jatuh Tempo Minggu Ini
          </CardTitle>
          <CardDescription>Tenggat invoice dalam 7 hari ke depan pada cakupan Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Estimasi nilai invoice</p>
              <p className="text-xl font-semibold">{formatCurrency(invoiceThisWeek.total)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-semibold">{invoiceThisWeek.items.length}</p>
              <p className="text-xs text-muted-foreground">tenggat invoice</p>
            </div>
          </div>
          {invoiceThisWeek.items.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">Tidak ada invoice jatuh tempo minggu ini.</p>
          ) : (
            <ul className="space-y-2">
              {invoiceThisWeek.items.map((d) => {
                const meta = STATUS_META[d.status];
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm">
                    <Receipt className="h-4 w-4 shrink-0 text-sky-600" />
                    <span className="font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.locationName} · {d.projectCode} · {formatCurrency(salesByLocation.get(d.locationId) ?? 0)}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{d.dueLabel}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={approvalsDueToday.length > 0 ? "border-amber-300" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-amber-600" />
            Approval Jatuh Tempo Hari Ini
            {approvalsDueToday.length > 0 && (
              <Badge variant="warning" className="ml-1">
                {approvalsDueToday.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Persetujuan yang harus diselesaikan hari ini pada cakupan Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          {approvalsDueToday.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Tidak ada approval yang jatuh tempo hari ini. 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {approvalsDueToday.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm"
                >
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.locationName} · {d.projectCode} · PIC {d.owner}
                  </span>
                  <span className="ml-auto text-xs font-medium text-amber-700">{d.dueLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={approvalsOverdue.length > 0 ? "border-rose-300" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Approval Overdue
            {approvalsOverdue.length > 0 && (
              <Badge variant="danger" className="ml-1">
                {approvalsOverdue.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Persetujuan yang sudah melewati tenggat, diurut dari paling terlambat.</CardDescription>
        </CardHeader>
        <CardContent>
          {approvalsOverdue.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada approval yang terlambat. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {approvalsOverdue.map((d) => {
                const daysLate = Math.abs(d.daysRelative);
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.locationName} · {d.projectCode} · PIC {d.owner}
                    </span>
                    <Badge variant="danger" className="ml-auto">
                      Terlambat {daysLate} hari
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Kalender Tenggat
                </CardTitle>
                <CardDescription>{deadlines.length} tenggat pada cakupan Anda</CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceOnly((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                  invoiceOnly ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Receipt className="h-4 w-4" />
                Deadline invoice ({invoiceCount})
              </button>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Receipt className="h-3 w-3" /> Penanda ini menandai tenggat terkait invoice (submit & pembayaran).
            </p>
          </CardHeader>
          <CardContent>
            <DeadlineCalendar items={deadlines} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenggat Terdekat</CardTitle>
            <CardDescription>{upcoming.length} agenda berikutnya</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada tenggat aktif.</p>
            ) : (
              <ol className="space-y-3">
                {upcoming.map((d) => {
                  const meta = STATUS_META[d.status];
                  return (
                    <li key={d.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.title}</span>
                        <Badge variant={meta.variant} className="ml-auto">
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span>{d.locationName} · {d.projectCode}</span>
                        <span>{d.dueLabel}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Detail Tanggal & Total Invoice
              </CardTitle>
              <CardDescription>Pilih tanggal untuk melihat tenggat dan estimasi nilai invoice.</CardDescription>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
              aria-label="Pilih tanggal"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!dateDetail ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Pilih tanggal terlebih dahulu.</p>
          ) : dateDetail.onDate.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada tenggat pada tanggal ini.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total estimasi invoice</p>
                  <p className="text-xl font-semibold">{formatCurrency(dateDetail.invoiceTotal)}</p>
                </div>
                <div className="ml-auto text-right text-xs text-muted-foreground">
                  <p>{dateDetail.invoiceItems.length} tenggat invoice</p>
                  <p>{dateDetail.onDate.length} total tenggat</p>
                </div>
              </div>
              <ol className="space-y-2">
                {dateDetail.onDate.map((d) => {
                  const meta = STATUS_META[d.status];
                  const invoice = isInvoiceDeadline(d.kind);
                  return (
                    <li
                      key={d.id}
                      className={cn("flex items-center gap-2 rounded-md border p-2 text-sm", invoice && "border-sky-200 bg-sky-50")}
                    >
                      {invoice && <Receipt className="h-4 w-4 shrink-0 text-sky-600" />}
                      <span className="font-medium">{d.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {d.locationName} · {d.projectCode}
                      </span>
                      {invoice && (
                        <span className="text-xs text-muted-foreground">
                          · {formatCurrency(salesByLocation.get(d.locationId) ?? 0)}
                        </span>
                      )}
                      <Badge variant={meta.variant} className="ml-auto">
                        {meta.label}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  tone: "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-6 w-6 shrink-0 ${toneClass}`} />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
