"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, Info, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { toCsv, parseCsv, downloadTextFile } from "@/lib/csv";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import {
  ImportPreview,
  validateRows,
  type ParsedRow,
} from "@/components/impor-excel/import-preview";

/** Expected columns for a Daily Sales import file. */
const COLUMNS = ["trxDate", "categoryKey", "qty", "price"] as const;
const SAMPLE: (string | number)[][] = [
  ["2026-08-01", "meals_buffet", 120, 45000],
  ["2026-08-01", "meals_packmeal", 60, 38000],
  ["2026-08-02", "meals_buffet", 110, 45000],
];

/** Per-column validators for a Daily Sales row (matches COLUMNS order). */
const VALIDATORS: ((value: string, row: string[]) => string | null)[] = [
  (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Tanggal tidak valid (YYYY-MM-DD)."),
  (v) => (v ? null : "Kategori kosong."),
  (v) => (Number(v) > 0 ? null : "Qty harus > 0."),
  (v) => (Number(v) >= 0 ? null : "Harga tidak valid."),
];

/**
 * Daily Sales Excel/CSV import page. The admin uploads a file, the client parses
 * it, validates each row against the expected columns, and shows a preview with
 * per-row validation before any import. A template download keeps the file
 * format aligned. Persona-scoped; no backend required at this stage.
 */
export function ImporExcelClient() {
  const { persona } = usePersona();
  const canImport =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [header, setHeader] = useState<string[] | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text).filter((r) => r.length && r.some((c) => c.trim() !== ""));
    setFileName(file.name);
    if (parsed.length === 0) {
      setHeader([]);
      setRows([]);
      return;
    }
    setHeader(parsed[0].map((h) => h.trim()));
    setRows(validateRows(parsed.slice(1), VALIDATORS));
  }

  function downloadTemplate() {
    downloadTextFile("template-daily-sales.csv", toCsv([[...COLUMNS], ...SAMPLE]));
  }

  function reset() {
    setFileName(null);
    setHeader(null);
    setRows([]);
  }

  return (
    <div>
      <PageHeader
        title="Impor Excel — Daily Sales"
        description="Unggah file CSV/Excel Daily Sales, validasi kolom dan baris sebelum impor."
        breadcrumbs={[{ label: "Operasional" }, { label: "Impor Excel" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={canImport ? "Dapat mengimpor" : "Hanya melihat"} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace tujuan</label>
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
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Unduh Template
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Kolom wajib: <b>{COLUMNS.join(", ")}</b>. File Excel harap disimpan sebagai CSV terlebih dahulu.
          </span>
        </div>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Unggah File
            </CardTitle>
            <CardDescription>Format .csv (hasil ekspor Excel).</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!canImport}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition",
                canImport
                  ? "border-input hover:border-primary hover:bg-accent/40"
                  : "cursor-not-allowed border-input opacity-60",
              )}
            >
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                {canImport ? "Klik untuk memilih file CSV" : "Persona ini tidak dapat mengimpor"}
              </span>
              {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            </button>
          </CardContent>
        </Card>

        {/* Preview */}
        {header !== null && (
          <ImportPreview
            columns={COLUMNS}
            header={header}
            rows={rows}
            fileName={fileName}
            onReset={reset}
            onConfirm={() => {}}
            confirmLabel={`Impor ke ${ws?.locationName ?? "site"}`}
          />
        )}
      </div>
    </div>
  );
}
