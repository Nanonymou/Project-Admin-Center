"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  History,
  Paperclip,
  Upload,
  UserCircle,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import { findInvoiceByNumber } from "@/lib/mock/invoice-lookup";
import { getSiteDetail, type MockInvoice, type SiteDetail } from "@/lib/mock/site-detail";
import { buildApprovalReminders } from "@/lib/mock/approvals";
import { buildInvoiceAuditTrail } from "@/lib/mock/invoice-audit";
import { AUDIT_ACTION_META } from "@/lib/mock/audit-trail";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";
import { BuktiPanel } from "@/components/upload-bukti/bukti-panel";

const STAGE_FLOW = ["Verifikasi Site", "Approval Leader", "Verifikasi Finance", "Kirim Client", "Payment"];

const STATUS_META = {
  onTime: { label: "On Time", variant: "success" as const },
  atRisk: { label: "At Risk", variant: "warning" as const },
  overdue: { label: "Overdue", variant: "danger" as const },
};

const BUCKET_COLOR: Record<string, string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

/** Map the DB invoice status enum to the client's InvoiceStatus. */
function mapDbStatus(status: string): MockInvoice["status"] {
  if (status === "overdue") return "overdue";
  if (status === "at_risk") return "atRisk";
  return "onTime";
}

export function InvoiceDetailClient({ invoiceNumber }: { invoiceNumber: string }) {
  const { persona } = usePersona();
  const router = useRouter();
  const mockLookup = findInvoiceByNumber(invoiceNumber);

  // Invoices created in the DB are not in the mock lookup — resolve them from
  // the API and pair the DB invoice with its site's context so the detail page
  // renders instead of 404-ing.
  const [dbLookup, setDbLookup] = useState<{ invoice: MockInvoice; detail: SiteDetail } | null>(null);
  const [invoiceDbId, setInvoiceDbId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(!mockLookup);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        const res = await fetch("/api/invoices?scope=executive", {
          headers: personaHeaders(persona.id),
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            source?: string;
            invoices?: Array<{
              id: string;
              number: string;
              projectId: string;
              locationId: string;
              amount: number | string;
              status: string;
              stage: string;
              agingBucket: string;
              dueDate: string | null;
              pic: string | null;
            }>;
          };
          const row = data.invoices?.find((i) => i.number === invoiceNumber);
          if (!cancelled && row) {
            // Real DB id enables real attachments regardless of the data source.
            setInvoiceDbId(row.id);
            // Only synthesize a lookup when the mock seed doesn't have it.
            const siteDetail = mockLookup ? undefined : getSiteDetail(row.locationId);
            if (!mockLookup && siteDetail) {
              setDbLookup({
                invoice: {
                  number: row.number,
                  amount: Number(row.amount) || 0,
                  stage: row.stage,
                  status: mapDbStatus(row.status),
                  agingBucket: row.agingBucket as MockInvoice["agingBucket"],
                  dueDate: row.dueDate ?? "",
                  pic: row.pic ?? "-",
                },
                detail: siteDetail,
              });
            }
          }
        }
      } catch {
        // ignore — falls through to not-found for DB-only invoices
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [mockLookup, invoiceNumber, persona.id]);

  const lookup = mockLookup ?? dbLookup;

  if (resolving && !lookup) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">Memuat detail invoice…</div>
    );
  }
  if (!lookup) notFound();
  const { invoice, detail } = lookup;

  const inScope = canAccessLocation(persona, detail.site.locationId, detail.site.projectCode);
  const approvalRecord = buildApprovalReminders(detail.site, detail).find(
    (a) => a.invoiceNumber === invoice.number,
  );
  const stageIndex = Math.max(0, STAGE_FLOW.indexOf(invoice.stage));
  const meta = STATUS_META[invoice.status];
  const auditTrail = buildInvoiceAuditTrail(invoice);

  if (!inScope) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-lg font-semibold">Akses ditolak</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Invoice <b>{invoice.number}</b> berada di site {detail.site.projectCode} · {detail.site.locationName},
              di luar scope peran <b>{persona.roleLabel}</b>.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`Detail invoice · ${detail.site.projectName} · ${detail.site.locationName}`}
        breadcrumbs={[
          { label: "Overview" },
          { label: "Invoice" },
          { label: invoice.number },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Link href={`/site/${detail.site.locationId}`}>
              <Button size="sm" variant="outline">
                <Building2 className="h-4 w-4" />
                Site Dashboard
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${detail.site.projectCode} · ${detail.site.locationName}`} />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetaCard label="Nilai Invoice" value={formatCurrency(invoice.amount)} icon={FileText} />
          <MetaCard label="Due Date" value={invoice.dueDate} icon={CalendarClock} />
          <MetaCard label="PIC" value={invoice.pic} icon={UserCircle} />
          <MetaCard
            label="Aging"
            value={invoice.agingBucket}
            icon={Clock}
            highlight={BUCKET_COLOR[invoice.agingBucket]}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progress Approval</CardTitle>
              <CardDescription>Alur stage sesuai Master Workflow project.</CardDescription>
            </CardHeader>
            <CardContent>
              <StageFlow currentStageIndex={stageIndex} />
              {approvalRecord && (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-4">
                  <MetaRow label="Assignee" value={approvalRecord.assignee} />
                  <MetaRow label="Time in stage" value={`${approvalRecord.timeInStageDays} hari`} />
                  <MetaRow label="SLA target" value={`${approvalRecord.slaTargetDays} hari`} />
                  <MetaRow label="Prioritas" value={approvalRecord.priority.toUpperCase()} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Ringkasan status invoice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Stage</span>
                <Badge variant="outline">{invoice.stage}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Bucket</span>
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: BUCKET_COLOR[invoice.agingBucket] }}
                >
                  {invoice.agingBucket}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Periode</span>
                <span>{detail.site.invoicePeriod}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cut-off</span>
                <span>
                  {detail.site.cutOffDaysLeft > 0
                    ? `H-${detail.site.cutOffDaysLeft}`
                    : "hari ini"}
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Timeline Aktivitas</CardTitle>
              <CardDescription>Kejadian terkait invoice ini (mock).</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                invoiceNumber={invoice.number}
                stage={invoice.stage}
                dueDate={invoice.dueDate}
                submittedAt={approvalRecord?.submittedAt}
                pic={invoice.pic}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Lampiran
              </CardTitle>
              <CardDescription>Dokumen pendukung — mock attachment.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentList invoiceNumber={invoice.number} invoiceId={invoiceDbId} personaId={persona.id} />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Trail
            </CardTitle>
            <CardDescription>
              Riwayat lengkap — siapa melakukan apa dan kapan pada invoice ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuditTrail entries={auditTrail} />
          </CardContent>
        </Card>

        <BuktiPanel
          projectCode={detail.site.projectCode}
          locationId={detail.site.locationId}
          title="Bukti Invoice"
        />
      </div>
    </div>
  );
}

function AuditTrail({ entries }: { entries: ReturnType<typeof buildInvoiceAuditTrail> }) {
  if (entries.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas tercatat.</div>;
  }
  // Newest first for display.
  const ordered = [...entries].sort((a, b) => a.offsetHours - b.offsetHours);
  return (
    <ol className="relative">
      {ordered.map((entry, i) => {
        const meta = AUDIT_ACTION_META[entry.action];
        return (
          <li key={entry.id} className="flex gap-3 py-2.5">
            <div className="relative mt-1 flex flex-col items-center">
              <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
              {i < ordered.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="text-sm font-medium">{entry.actor}</span>
                <span className="text-[11px] text-muted-foreground">· {entry.role}</span>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{entry.timeLabel}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MetaCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div
          className={cn("mt-1.5 truncate text-lg font-semibold tabular-nums")}
          style={highlight ? { color: highlight } : undefined}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function StageFlow({ currentStageIndex }: { currentStageIndex: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      {STAGE_FLOW.map((stage, i) => {
        const state = i < currentStageIndex ? "done" : i === currentStageIndex ? "current" : "upcoming";
        return (
          <li key={stage} className="flex-1">
            <div
              className={cn(
                "flex items-center justify-between rounded-md border p-2 text-xs sm:h-16 sm:flex-col sm:items-start sm:justify-center sm:rounded-none sm:border-r-0 sm:first:rounded-l-md sm:last:rounded-r-md sm:last:border-r",
                state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                state === "current" && "border-primary bg-primary/10 text-primary",
                state === "upcoming" && "border-input bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">Stage {i + 1}</span>
              <span className="text-sm font-medium">{stage}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityTimeline({
  invoiceNumber,
  stage,
  dueDate,
  submittedAt,
  pic,
}: {
  invoiceNumber: string;
  stage: string;
  dueDate: string;
  submittedAt?: string;
  pic: string;
}) {
  const items = [
    submittedAt && {
      time: submittedAt,
      title: "Invoice disubmit",
      detail: `${invoiceNumber} masuk ke queue oleh ${pic}`,
      tone: "info",
    },
    {
      time: "2 hari lalu",
      title: `Masuk stage ${stage}`,
      detail: "Notifikasi otomatis dikirim ke assignee.",
      tone: "info",
    },
    {
      time: "kemarin",
      title: "Reminder H-3 dikirim",
      detail: "Notifikasi ke Leader Admin untuk approval.",
      tone: "warning",
    },
    {
      time: dueDate,
      title: "Due date invoice",
      detail: "Batas akhir target sesuai Master Workflow.",
      tone: "info",
    },
  ].filter(Boolean) as {
    time: string;
    title: string;
    detail: string;
    tone: string;
  }[];
  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 py-2">
          <div className="relative mt-1 flex flex-col items-center">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full ring-4 ring-background",
                item.tone === "warning" ? "bg-amber-500" : "bg-sky-500",
              )}
            />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{item.detail}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{item.time}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

type Attachment = {
  id: string;
  name: string;
  size: string;
  type: string;
  uploaded?: boolean;
  url?: string;
  persisted?: boolean;
};

function sizeText(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} kB`;
}

function AttachmentList({
  invoiceNumber,
  invoiceId,
  personaId,
}: {
  invoiceNumber: string;
  invoiceId: string | null;
  personaId: string;
}) {
  const seed: Attachment[] = [
    { id: "seed-1", name: `${invoiceNumber.replace(/\//g, "-")}.pdf`, size: "1,2 MB", type: "Invoice PDF" },
    { id: "seed-2", name: "berita-acara.pdf", size: "480 kB", type: "Berita Acara" },
    { id: "seed-3", name: "supporting-doc.xlsx", size: "220 kB", type: "Rekap Kuantitas" },
  ];
  const [attachments, setAttachments] = useState<Attachment[]>(seed);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // When the invoice exists in the DB, attachments are real (persisted); the
  // config seed is only shown for mock-only invoices with no DB id.
  const live = invoiceId !== null;

  const loadAttachments = useCallback(async () => {
    if (!invoiceId) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/attachments`, {
        headers: personaHeaders(personaId),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        source?: string;
        attachments?: Array<{ id: string; fileName: string; fileType?: string | null; sizeBytes?: number | null; storageKey?: string | null }>;
      };
      if (data.source === "db" && Array.isArray(data.attachments)) {
        setAttachments(
          data.attachments.map((a) => {
            const key = a.storageKey ?? "";
            return {
              id: a.id,
              name: a.fileName,
              size: sizeText(a.sizeBytes ?? 0),
              type: a.fileType?.includes("pdf") ? "PDF" : a.fileType?.includes("image") ? "Gambar" : "Dokumen",
              url: key.startsWith("http") ? key : undefined,
              persisted: true,
            };
          }),
        );
      }
    } catch {
      // keep current list
    }
  }, [invoiceId, personaId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (invoiceId) {
      // Persist the real document to the invoice.
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/invoices/${invoiceId}/attachments/upload`, {
          method: "POST",
          headers: personaHeaders(personaId),
          body: fd,
        });
        if (res.ok) await loadAttachments();
      } catch {
        // best-effort
      } finally {
        setUploading(false);
      }
      return;
    }

    // Mock-only invoice: keep the previous session-local behavior.
    setAttachments((prev) => [
      ...prev,
      { id: `up-${Date.now()}`, name: file.name, size: sizeText(file.size), type: "Upload", uploaded: true },
    ]);
  }

  async function remove(att: Attachment) {
    if (invoiceId && att.persisted) {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/attachments/${att.id}`, {
          method: "DELETE",
          headers: personaHeaders(personaId),
        });
        if (res.ok) await loadAttachments();
      } catch {
        // best-effort
      }
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  return (
    <div className="space-y-3">
      {live && (
        <div className="flex items-center gap-2 text-xs text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Dokumen tersimpan di database.
        </div>
      )}
      <ul className="divide-y">
        {attachments.map((att) => (
          <li key={att.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{att.name}</div>
              <div className="text-[11px] text-muted-foreground">{att.type} · {att.size}</div>
            </div>
            {att.url && (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                Buka
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {att.uploaded || att.persisted ? (
              <button
                type="button"
                onClick={() => remove(att)}
                className="rounded-md p-1 text-muted-foreground hover:text-rose-600"
                aria-label={`Hapus ${att.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              !att.url && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  Preview
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      <input ref={inputRef} type="file" className="hidden" onChange={onUpload} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" />
        {uploading ? "Mengunggah…" : "Unggah Dokumen"}
      </Button>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
