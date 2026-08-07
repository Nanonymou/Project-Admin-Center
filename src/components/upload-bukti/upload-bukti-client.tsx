"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, Upload, CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const STATUS_ICON: Record<BuktiStatus, typeof Clock> = {
  pending: Clock,
  verified: CheckCircle2,
  rejected: XCircle,
};

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

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const firstSite = seeded[0];
    const now = new Date();
    const added: BuktiRecord[] = Array.from(files).map((f, i) => {
      const isPdf = f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
      return {
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
      };
    });
    setUploaded((prev) => [...added, ...prev]);
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
            <CardDescription>Format didukung: JPG, PNG, PDF. Maksimal 5 MB per berkas.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
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
    </div>
  );
}
