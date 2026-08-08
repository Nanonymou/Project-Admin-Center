"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, ImageIcon, Paperclip } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import {
  buildBuktiRecords,
  BUKTI_STATUS_META,
  type BuktiRecord,
} from "@/lib/mock/upload-bukti";

function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} kB`;
}

function placeholderImage(record: BuktiRecord): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
    <rect width="640" height="420" fill="#f1f5f9"/>
    <rect x="20" y="20" width="600" height="380" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <text x="320" y="190" font-family="sans-serif" font-size="24" fill="#334155" text-anchor="middle">${record.kindLabel}</text>
    <text x="320" y="230" font-family="sans-serif" font-size="16" fill="#64748b" text-anchor="middle">${record.reference}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Compact, embeddable evidence panel — a site-scoped slice of the Upload Bukti
 * center for reuse inside other pages (e.g. Daily Cost). Lists the evidence
 * already uploaded for a location with an inline preview, so an admin can check
 * supporting documents without leaving the transaction page. Seeded from the
 * shared mock; no backend required.
 */
export function BuktiPanel({
  projectCode,
  locationId,
  title = "Bukti Terunggah",
  limit = 6,
}: {
  projectCode: string;
  locationId: string;
  title?: string;
  limit?: number;
}) {
  const records = useMemo(
    () =>
      buildBuktiRecords()
        .filter((r) => r.locationId === locationId && r.projectCode === projectCode)
        .slice(0, limit),
    [projectCode, locationId, limit],
  );

  const [preview, setPreview] = useState<BuktiRecord | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>Bukti pendukung untuk lokasi ini ({records.length}).</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {records.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Belum ada bukti untuk lokasi ini.</div>
        ) : (
          <ul className="divide-y">
            {records.map((r) => {
              const meta = BUKTI_STATUS_META[r.status];
              const FileIcon = r.fileType === "pdf" ? FileText : ImageIcon;
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.fileName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.kindLabel} · {sizeLabel(r.sizeKb)} · {formatDateTime(r.uploadedAt)}
                    </div>
                  </div>
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setPreview(r)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Pratinjau Bukti"
        description={preview ? `${preview.fileName} · ${sizeLabel(preview.sizeKb)}` : undefined}
        className="max-w-2xl"
      >
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="info">{preview.kindLabel}</Badge>
              <Badge variant={BUKTI_STATUS_META[preview.status].badge}>
                {BUKTI_STATUS_META[preview.status].label}
              </Badge>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{preview.reference}</span>
            </div>
            {preview.fileType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url ?? placeholderImage(preview)}
                alt={preview.fileName}
                className="mx-auto max-h-[55vh] w-auto rounded-md border"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-md border border-amber-200 bg-amber-50 py-10 text-center text-sm text-amber-900">
                <FileText className="h-10 w-10 text-amber-500" />
                <div className="font-medium">Pratinjau PDF tidak tersedia untuk data contoh</div>
                <div className="text-xs text-muted-foreground">{preview.fileName}</div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </Card>
  );
}
