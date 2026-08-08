"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, Info, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { toCsv, parseCsv, downloadTextFile } from "@/lib/csv";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/** Expected columns for a Daily Sales import file. */
const COLUMNS = ["trxDate", "categoryKey", "qty", "price"] as const;
const SAMPLE: (string | number)[][] = [
  ["2026-08-01", "meals_buffet", 120, 45000],
  ["2026-08-01", "meals_packmeal", 60, 38000],
  ["2026-08-02", "meals_buffet", 110, 45000],
];

type ParsedRow = {
  cells: string[];
  valid: boolean;
  issues: string[];
};

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

  const headerOk =
    header !== null &&
    header.length >= COLUMNS.length &&
    COLUMNS.every((c, i) => (header[i] ?? "").trim().toLowerCase() === c.toLowerCase());

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  function validateRow(cells: string[]): ParsedRow {
    const issues: string[] = [];
    const [trxDate, categoryKey, qty, price] = cells;
    if (!trxDate || !/^\d{4}-\d{2}-\d{2}$/.test(trxDate.trim())) issues.push("Tanggal tidak valid (YYYY-MM-DD).");
    if (!categoryKey || !categoryKey.trim()) issues.push("Kategori kosong.");
    if (!(Number(qty) > 0)) issues.push("Qty harus > 0.");
    if (!(Number(price) >= 0)) issues.push("Harga tidak valid.");
    return { cells, valid: issues.length === 0, issues };
  }

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
    setRows(parsed.slice(1).map((r) => validateRow(r)));
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
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
              <div>
                <CardTitle>Pratinjau &amp; Validasi</CardTitle>
                <CardDescription>{rows.length} baris terbaca dari {fileName}.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={headerOk ? "success" : "danger"}>
                  Header {headerOk ? "cocok" : "tidak cocok"}
                </Badge>
                <Badge variant="success">{validCount} valid</Badge>
                {invalidCount > 0 && <Badge variant="danger">{invalidCount} invalid</Badge>}
                <Button size="sm" variant="ghost" onClick={reset}>
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!headerOk && (
                <div className="mx-4 mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Kolom yang diharapkan: <b>{COLUMNS.join(", ")}</b>. Perbaiki header file lalu unggah ulang.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      {COLUMNS.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-medium">
                          {c}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                          Tidak ada baris data.
                        </td>
                      </tr>
                    )}
                    {rows.map((r, i) => (
                      <tr key={i} className={cn("border-b last:border-0", !r.valid && "bg-rose-50")}>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        {COLUMNS.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 tabular-nums">
                            {r.cells[ci] ?? "—"}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {r.valid ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-700" title={r.issues.join(" ")}>
                              <XCircle className="h-3.5 w-3.5" />
                              {r.issues[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2 border-t p-3">
                <Button size="sm" disabled={!headerOk || validCount === 0}>
                  <Upload className="h-4 w-4" />
                  Impor {validCount} baris ke {ws?.locationName ?? "site"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
