"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, ImageIcon, MapPin, Paperclip, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

type Attachment = {
  id: string;
  name: string;
  kind: string;
  fileType: "image" | "pdf";
  sizeLabel: string;
};

const DOC_KINDS = [
  { key: "po", label: "Purchase Order", type: "pdf" as const },
  { key: "faktur", label: "Faktur Pajak", type: "pdf" as const },
  { key: "ba", label: "Berita Acara", type: "image" as const },
  { key: "timesheet", label: "Timesheet", type: "image" as const },
  { key: "kwitansi", label: "Kwitansi", type: "image" as const },
];

function placeholderImage(name: string, kind: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
    <rect width="640" height="420" fill="#f1f5f9"/>
    <rect x="20" y="20" width="600" height="380" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <text x="320" y="190" font-family="sans-serif" font-size="26" fill="#334155" text-anchor="middle">${kind}</text>
    <text x="320" y="230" font-family="sans-serif" font-size="16" fill="#64748b" text-anchor="middle">${name}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Pratinjau Lampiran — an invoice's attachment gallery, seeded with mock
 * documents (PO, faktur pajak, berita acara, …). Each thumbnail opens an inline
 * preview: placeholder images render directly; PDFs show a not-available notice.
 * Persona-scoped; no backend required.
 */
export function PratinjauLampiranClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const attachments = useMemo<Attachment[]>(() => {
    if (!ws) return [];
    let h = 0;
    for (let i = 0; i < ws.locationId.length; i++) h = (h * 31 + ws.locationId.charCodeAt(i)) & 0xffffffff;
    const seed = Math.abs(h);
    return DOC_KINDS.map((d, i) => ({
      id: `att-${ws.locationId}-${i}`,
      name: `${d.key}-${ws.projectCode.toLowerCase()}-${String(i + 1).padStart(3, "0")}.${d.type === "pdf" ? "pdf" : "jpg"}`,
      kind: d.label,
      fileType: d.type,
      sizeLabel: `${120 + ((seed + i * 37) % 900)} kB`,
    }));
  }, [ws]);

  // Index-based preview so the modal can navigate between attachments.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const preview = previewIndex !== null ? attachments[previewIndex] ?? null : null;

  function step(delta: number) {
    setPreviewIndex((i) =>
      i === null || attachments.length === 0 ? i : (i + delta + attachments.length) % attachments.length,
    );
  }

  // Arrow-key navigation while the preview is open.
  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, attachments.length]);

  function download(a: Attachment) {
    if (a.fileType !== "image") return;
    const link = document.createElement("a");
    link.href = placeholderImage(a.name, a.kind);
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const invoiceNo = ws ? `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}` : "";

  if (!ws) {
    return (
      <div>
        <PageHeader title="Pratinjau Lampiran" description="Pratinjau lampiran invoice." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada invoice dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pratinjau Lampiran"
        description="Galeri lampiran invoice dengan pratinjau dokumen langsung."
        breadcrumbs={[{ label: "Operasional" }, { label: "Pratinjau Lampiran" }]}
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              Lampiran {invoiceNo}
            </CardTitle>
            <CardDescription>{attachments.length} dokumen · klik untuk pratinjau.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {attachments.map((a, idx) => {
                const Icon = a.fileType === "pdf" ? FileText : ImageIcon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPreviewIndex(idx)}
                    className="group flex flex-col overflow-hidden rounded-lg border text-left transition hover:border-primary"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                      {a.fileType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={placeholderImage(a.name, a.kind)} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="truncate text-xs font-medium">{a.kind}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{a.sizeLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Dialog
        open={preview !== null}
        onClose={() => setPreviewIndex(null)}
        title="Pratinjau Lampiran"
        description={
          preview
            ? `${preview.kind} · ${preview.name} · ${preview.sizeLabel} · ${(previewIndex ?? 0) + 1}/${attachments.length}`
            : undefined
        }
        className="max-w-3xl"
        footer={
          preview && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => step(-1)} disabled={attachments.length < 2}>
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button size="sm" variant="outline" onClick={() => step(1)} disabled={attachments.length < 2}>
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(preview)} disabled={preview.fileType !== "image"}>
                <Download className="h-4 w-4" />
                Unduh
              </Button>
            </div>
          )
        }
      >
        {preview && (
          <div className="space-y-3">
            <Badge variant="info">{preview.kind}</Badge>
            {preview.fileType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={placeholderImage(preview.name, preview.kind)}
                alt={preview.name}
                className={cn("mx-auto max-h-[60vh] w-auto rounded-md border")}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-md border border-amber-200 bg-amber-50 py-12 text-center text-sm text-amber-900">
                <FileText className="h-10 w-10 text-amber-500" />
                <div className="font-medium">Pratinjau PDF tidak tersedia untuk data contoh</div>
                <div className="text-xs text-muted-foreground">{preview.name}</div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
