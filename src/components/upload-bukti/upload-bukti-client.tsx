"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  ImageIcon,
  Paperclip,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatDateTime } from "@/lib/utils";
import {
  buildBuktiRecords,
  BUKTI_KINDS,
  BUKTI_STATUS_META,
  BUKTI_STATUSES,
  type BuktiRecord,
  type BuktiStatus,
} from "@/lib/mock/upload-bukti";

function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} kB`;
}

/**
 * A lightweight placeholder image (inline SVG data URI) for seeded mock records
 * that have no real file — so image previews still render something meaningful
 * without any network asset.
 */
function placeholderImage(record: BuktiRecord): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
    <rect width="640" height="420" fill="#f1f5f9"/>
    <rect x="20" y="20" width="600" height="380" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <text x="320" y="180" font-family="sans-serif" font-size="26" fill="#334155" text-anchor="middle">${record.kindLabel}</text>
    <text x="320" y="220" font-family="sans-serif" font-size="18" fill="#64748b" text-anchor="middle">${record.reference}</text>
    <text x="320" y="260" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">${record.fileName}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const STATUS_ICON: Record<BuktiStatus, typeof Clock> = {
  pending: Clock,
  verified: CheckCircle2,
  rejected: XCircle,
};

/** Upload constraints — must match the accept hint shown to the user. */
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf"];
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

/** Validate one file; returns an error message, or null when acceptable. */
function validateFile(f: File): string | null {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  const okType = ALLOWED_MIME.includes(f.type) || ALLOWED_EXT.includes(ext);
  if (!okType) {
    return `${f.name}: format tidak didukung (hanya JPG, PNG, PDF).`;
  }
  if (f.size > MAX_SIZE_BYTES) {
    const mb = (f.size / (1024 * 1024)).toFixed(1);
    return `${f.name}: ukuran ${mb} MB melebihi batas ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

/**
 * Core Upload Bukti (evidence) workspace. Renders an upload zone plus a
 * filterable list of uploaded evidence, seeded from mock data and scoped to the
 * active persona (a Site Admin sees only their own sites). Newly "uploaded"
 * files are added to local state — no backend is required at this stage.
 */
export function UploadBuktiClient() {
  const { persona } = usePersona();
  const canUpload =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const seeded = useMemo(
    () => buildBuktiRecords().filter((r) => canAccessLocation(persona, r.locationId, r.projectCode)),
    [persona],
  );
  const [uploaded, setUploaded] = useState<BuktiRecord[]>([]);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BuktiStatus>("all");
  const [errors, setErrors] = useState<string[]>([]);
  const [okCount, setOkCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => [...uploaded, ...seeded], [uploaded, seeded]);
  const records = useMemo(
    () =>
      all.filter(
        (r) =>
          (kindFilter === "all" || r.kind === kindFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [all, kindFilter, statusFilter],
  );

  const counts = useMemo(() => {
    const c: Record<BuktiStatus, number> = { pending: 0, verified: 0, rejected: 0 };
    for (const r of all) c[r.status] += 1;
    return c;
  }, [all]);

  // Document preview — index into the currently filtered `records` list.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewRecord = previewIndex !== null ? records[previewIndex] ?? null : null;

  function step(delta: number) {
    setPreviewIndex((i) =>
      i === null || records.length === 0 ? i : (i + delta + records.length) % records.length,
    );
  }

  // Arrow-key navigation while the preview dialog is open.
  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, records.length]);

  function download(record: BuktiRecord) {
    const href = record.url ?? (record.fileType === "image" ? placeholderImage(record) : null);
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = record.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const firstSite = seeded[0];
    const now = new Date();
    const nextErrors: string[] = [];
    const added: BuktiRecord[] = [];
    Array.from(files).forEach((f, i) => {
      const error = validateFile(f);
      if (error) {
        nextErrors.push(error);
        return;
      }
      const isPdf = f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
      added.push({
        id: `local-${now.getTime()}-${i}`,
        projectCode: firstSite?.projectCode ?? persona.scope.projects[0] ?? "BUMA",
        locationId: firstSite?.locationId ?? persona.scope.locations[0] ?? "loc-km22",
        locationName: firstSite?.locationName ?? "Site",
        kind: "payment",
        kindLabel: "Bukti Pembayaran",
        fileName: f.name,
        fileType: isPdf ? "pdf" : "image",
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        status: "pending",
        reference: `PAYMENT/${firstSite?.projectCode ?? "BUMA"}/NEW`,
        uploadedBy: persona.roleLabel,
        uploadedAt: now.toISOString(),
        url: URL.createObjectURL(f),
      });
    });
    setErrors(nextErrors);
    setOkCount(added.length);
    if (added.length > 0) setUploaded((prev) => [...added, ...prev]);
  }

  return (
    <div>
      <PageHeader
        title="Upload Bukti"
        description="Pusat unggah bukti transaksi — pembayaran, invoice, serah terima, dan kwitansi."
        breadcrumbs={[{ label: "Operasional" }, { label: "Upload Bukti" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={canUpload ? "Dapat mengunggah bukti" : "Hanya melihat"}
        />

        {/* Status summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BUKTI_STATUSES.map((s) => {
            const meta = BUKTI_STATUS_META[s];
            const Icon = STATUS_ICON[s];
            return (
              <Card key={s}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{counts[s]}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Upload zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Unggah Bukti Baru
            </CardTitle>
            <CardDescription>
              Format didukung: JPG, PNG, PDF. Maksimal {MAX_SIZE_MB} MB per berkas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!canUpload}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition",
                canUpload
                  ? "border-input hover:border-primary hover:bg-accent/40"
                  : "cursor-not-allowed border-input opacity-60",
              )}
            >
              <Paperclip className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                {canUpload ? "Klik untuk memilih berkas bukti" : "Persona ini tidak dapat mengunggah"}
              </span>
              <span className="text-xs text-muted-foreground">Bukti yang diunggah akan berstatus menunggu verifikasi.</span>
            </button>

            {okCount > 0 && errors.length === 0 && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{okCount} berkas berhasil ditambahkan dan menunggu verifikasi.</span>
              </div>
            )}

            {errors.length > 0 && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {errors.length} berkas ditolak
                  {okCount > 0 && <span className="font-normal">· {okCount} diterima</span>}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-6">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters + list */}
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <CardTitle>Daftar Bukti</CardTitle>
              <CardDescription>{records.length} bukti pada cakupan Anda.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Semua Jenis</option>
                {BUKTI_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 text-xs">
                {(["all", ...BUKTI_STATUSES] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium",
                      statusFilter === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {s === "all" ? "Semua" : BUKTI_STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Belum ada bukti sesuai filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Berkas</th>
                      <th className="px-3 py-2 text-left font-medium">Jenis</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Referensi</th>
                      <th className="px-3 py-2 text-left font-medium">Diunggah</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const meta = BUKTI_STATUS_META[r.status];
                      const FileIcon = r.fileType === "pdf" ? FileText : ImageIcon;
                      return (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{r.fileName}</div>
                                <div className="text-[11px] text-muted-foreground">{sizeLabel(r.sizeKb)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.kindLabel}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.reference}</td>
                          <td className="px-3 py-2">
                            <div className="text-xs">{formatDateTime(r.uploadedAt)}</div>
                            <div className="text-[11px] text-muted-foreground">{r.uploadedBy}</div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={meta.badge}>{meta.label}</Badge>
                            {r.note && <div className="mt-1 text-[11px] text-rose-600">{r.note}</div>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewIndex(records.findIndex((x) => x.id === r.id))}
                            >
                              <Eye className="h-4 w-4" />
                              Pratinjau
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document preview */}
      <Dialog
        open={previewRecord !== null}
        onClose={() => setPreviewIndex(null)}
        title="Pratinjau Dokumen"
        description={
          previewRecord
            ? `${previewRecord.fileName} · ${sizeLabel(previewRecord.sizeKb)} · ${(previewIndex ?? 0) + 1}/${records.length}`
            : undefined
        }
        className="max-w-3xl"
        footer={
          previewRecord && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => step(-1)} disabled={records.length < 2}>
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button size="sm" variant="outline" onClick={() => step(1)} disabled={records.length < 2}>
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(previewRecord)}>
                <Download className="h-4 w-4" />
                Unduh
              </Button>
            </div>
          )
        }
      >
        {previewRecord && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="info">{previewRecord.kindLabel}</Badge>
              <Badge variant={BUKTI_STATUS_META[previewRecord.status].badge}>
                {BUKTI_STATUS_META[previewRecord.status].label}
              </Badge>
              <span className="text-muted-foreground">
                {previewRecord.locationName} · {previewRecord.projectCode}
              </span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{previewRecord.reference}</span>
            </div>

            {previewRecord.fileType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewRecord.url ?? placeholderImage(previewRecord)}
                alt={previewRecord.fileName}
                className="mx-auto max-h-[55vh] w-auto rounded-md border"
              />
            ) : previewRecord.url ? (
              <iframe
                src={previewRecord.url}
                title={previewRecord.fileName}
                className="h-[55vh] w-full rounded-md border"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-md border border-amber-200 bg-amber-50 py-10 text-center text-sm text-amber-900">
                <FileText className="h-10 w-10 text-amber-500" />
                <div className="font-medium">Pratinjau PDF tidak tersedia untuk data contoh</div>
                <p className="max-w-xs text-xs">
                  Berkas contoh tidak menyimpan file asli. Unggah dokumen untuk melihat pratinjau langsung.
                </p>
                <div className="text-xs text-muted-foreground">{previewRecord.fileName}</div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
