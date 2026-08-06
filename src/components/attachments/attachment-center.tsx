"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type Attachment = {
  id: string;
  name: string;
  sizeLabel: string;
  isImage: boolean;
  isPdf: boolean;
  url: string;
};

function fileSizeLabel(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(kb))} kB`;
}

/**
 * Reusable attachment center for transaction forms — drop/upload zone plus a
 * responsive grid of uploaded files with image thumbnails. Self-managed state;
 * `onChange` reports the current list to the parent form.
 */
export function AttachmentCenter({
  title = "Attachment Center",
  accept = "image/*,.pdf,.xlsx,.csv",
  readOnly = false,
  onChange,
  onPreview,
}: {
  title?: string;
  accept?: string;
  readOnly?: boolean;
  onChange?: (items: Attachment[]) => void;
  onPreview?: (item: Attachment) => void;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewItem, setPreviewItem] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function preview(it: Attachment) {
    setPreviewItem(it);
    onPreview?.(it);
  }

  function addFiles(files: FileList | File[]) {
    const next = [...items];
    for (const f of Array.from(files)) {
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      next.push({
        id: `att-${Date.now()}-${next.length}`,
        name: f.name,
        sizeLabel: fileSizeLabel(f.size),
        isImage,
        isPdf,
        url: isImage || isPdf ? URL.createObjectURL(f) : "",
      });
    }
    setItems(next);
    onChange?.(next);
  }

  function remove(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-primary" />
          {title}
          <span className="text-[11px] font-normal text-muted-foreground">({items.length})</span>
        </div>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Unggah
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-6 text-center text-xs transition-colors",
            dragOver ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:bg-accent/40",
          )}
        >
          <Upload className="h-5 w-5" />
          <span>Seret & lepas file di sini, atau klik untuk memilih.</span>
          <span className="text-[10px]">Gambar, PDF, atau Excel — bukti transaksi.</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
          Belum ada lampiran.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="group relative rounded-md border p-2">
              <button
                type="button"
                onClick={() => preview(it)}
                className="block w-full text-left"
                title="Pratinjau"
              >
                <div className="flex h-20 items-center justify-center overflow-hidden rounded bg-muted">
                  {it.isImage && it.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.url} alt={it.name} className="h-full w-full object-cover" />
                  ) : it.isImage ? (
                    <ImageIcon className="h-7 w-7 text-muted-foreground" />
                  ) : (
                    <FileText className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-1 truncate text-[11px] font-medium">{it.name}</div>
                <div className="text-[10px] text-muted-foreground">{it.sizeLabel}</div>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-muted-foreground opacity-0 shadow group-hover:opacity-100 hover:text-rose-600"
                  aria-label={`Hapus ${it.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={previewItem !== null}
        onClose={() => setPreviewItem(null)}
        title="Pratinjau Lampiran"
        description={previewItem ? `${previewItem.name} · ${previewItem.sizeLabel}` : undefined}
      >
        {previewItem?.isImage && previewItem.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewItem.url}
            alt={previewItem.name}
            className="mx-auto max-h-[60vh] w-auto rounded-md border"
          />
        ) : previewItem?.isPdf && previewItem.url ? (
          <iframe
            src={previewItem.url}
            title={previewItem.name}
            className="h-[60vh] w-full rounded-md border"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10" />
            <div>Pratinjau tersedia untuk gambar (JPG/PNG) dan PDF.</div>
            <div className="text-xs">{previewItem?.name}</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
