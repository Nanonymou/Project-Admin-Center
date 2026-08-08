"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, Info, MapPin, CheckCircle2, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
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

  type ImportedRecord = {
    id: string;
    trxDate: string;
    categoryKey: string;
    qty: number;
    price: number;
    locationName: string;
    projectCode: string;
  };
  const [imported, setImported] = useState<ImportedRecord[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);

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

    // Validate each row, then flag rows that duplicate an earlier row's key
    // (trxDate + categoryKey) — the first occurrence is kept, later ones flagged.
    const validated = validateRows(parsed.slice(1), VALIDATORS);
    const seen = new Set<string>();
    for (const row of validated) {
      const key = `${(row.cells[0] ?? "").trim()}|${(row.cells[1] ?? "").trim().toLowerCase()}`;
      if (seen.has(key)) {
        row.duplicate = true;
        row.valid = false;
        row.issues = ["Baris duplikat (tanggal + kategori sama).", ...row.issues];
      } else {
        seen.add(key);
      }
    }
    setRows(validated);
  }

  const duplicateCount = rows.filter((r) => r.duplicate).length;
  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  function downloadTemplate() {
    downloadTextFile("template-daily-sales.csv", toCsv([[...COLUMNS], ...SAMPLE]));
  }

  function reset() {
    setFileName(null);
    setHeader(null);
    setRows([]);
  }

  function confirmImport() {
    const okRows = rows.filter((r) => r.valid && !r.duplicate);
    if (okRows.length === 0 || !ws) return;
    const now = Date.now();
    const records: ImportedRecord[] = okRows.map((r, i) => ({
      id: `imp-${now}-${i}`,
      trxDate: r.cells[0],
      categoryKey: r.cells[1],
      qty: Number(r.cells[2]) || 0,
      price: Number(r.cells[3]) || 0,
      locationName: ws.locationName,
      projectCode: ws.projectCode,
    }));
    setImported((prev) => [...records, ...prev]);
    setImportMsg(`${records.length} baris berhasil diimpor ke ${ws.locationName}.`);
    reset();
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

        {/* Result summary */}
        {header !== null && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
                <div className="text-xs text-muted-foreground">Total Baris</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-semibold tabular-nums text-emerald-700">{validCount}</div>
                <div className="text-xs text-muted-foreground">Valid</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-semibold tabular-nums text-rose-700">{invalidCount}</div>
                <div className="text-xs text-muted-foreground">Invalid</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-semibold tabular-nums text-amber-700">{duplicateCount}</div>
                <div className="text-xs text-muted-foreground">Duplikat</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview */}
        {header !== null && (
          <ImportPreview
            columns={COLUMNS}
            header={header}
            rows={rows}
            fileName={fileName}
            onReset={reset}
            onConfirm={confirmImport}
            confirmLabel={`Impor ${validCount} baris ke ${ws?.locationName ?? "site"}`}
          />
        )}

        {importMsg && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{importMsg}</span>
          </div>
        )}

        {/* Daily Sales list — updated after each import */}
        {imported.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Daftar Daily Sales (hasil impor)
              </CardTitle>
              <CardDescription>{imported.length} entri terimpor pada sesi ini.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Harga</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imported.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(r.trxDate)}
                          <Badge variant="info" className="ml-2">
                            Impor
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.locationName}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.categoryKey}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(r.price)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(r.qty * r.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
