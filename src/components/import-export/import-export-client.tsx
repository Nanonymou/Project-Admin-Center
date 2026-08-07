"use client";

import { useRef, useState } from "react";
import { Database, Download, FileSpreadsheet, Info, Upload, Wallet, ShoppingCart, FileText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
import { toCsv, parseCsv, downloadTextFile } from "@/lib/csv";
import { formatNumber } from "@/lib/utils";

type DataKind = {
  key: string;
  label: string;
  icon: typeof FileText;
  headers: string[];
  sampleRows: (string | number)[][];
};

const DATA_KINDS: DataKind[] = [
  {
    key: "daily_sales",
    label: "Daily Sales",
    icon: ShoppingCart,
    headers: ["Tanggal", "Area", "Kategori", "Qty", "Harga"],
    sampleRows: [
      ["2026-08-01", "Kantin A", "Meals Buffet", 120, 45000],
      ["2026-08-01", "Kantin A", "Meals Packmeal", 60, 38000],
    ],
  },
  {
    key: "daily_cost",
    label: "Daily Cost",
    icon: Wallet,
    headers: ["Tanggal", "Kategori", "Nominal"],
    sampleRows: [
      ["2026-08-01", "Food Cost Meals", 3200000],
      ["2026-08-01", "Cash Advance", 500000],
    ],
  },
  {
    key: "invoice",
    label: "Invoice",
    icon: FileText,
    headers: ["Nomor", "Project", "Nilai", "Status"],
    sampleRows: [
      ["INV/2026/08/BUMA/0001", "BUMA", 125000000, "outstanding"],
      ["INV/2026/08/PHSS/0007", "PHSS", 88000000, "settled"],
    ],
  },
  {
    key: "master",
    label: "Master Data",
    icon: Database,
    headers: ["Kode", "Nama", "Periode", "Pajak"],
    sampleRows: [
      ["BUMA", "BUMA Tabang", "15-14", "PPN 11%"],
      ["PHSS", "PHSS", "1-end", "PB1 10%"],
    ],
  },
];

type Job = { id: string; kind: string; direction: "export" | "import"; file: string; rows: number; at: string; by: string };

export function ImportExportClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "leader_admin" || persona.role === "super_admin" || persona.role === "site_admin";

  const [jobs, setJobs] = useState<Job[]>([]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  type ImportResult = {
    kind: DataKind;
    fileName: string;
    header: string[];
    headerOk: boolean;
    valid: number;
    invalid: number;
    preview: string[][];
  };
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [exportKindState, setExportKindState] = useState<DataKind | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportFilter, setExportFilter] = useState("");

  const exportRows = exportKindState
    ? exportKindState.sampleRows.filter((r) =>
        exportFilter.trim() ? r.join(" ").toLowerCase().includes(exportFilter.trim().toLowerCase()) : true,
      )
    : [];

  function logJob(kind: string, direction: "export" | "import", file: string, rows: number) {
    setJobs((prev) => [
      {
        id: `job-${Date.now()}`,
        kind,
        direction,
        file,
        rows,
        at: new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        by: persona.roleLabel,
      },
      ...prev,
    ]);
  }

  function openExport(kind: DataKind) {
    setExportKindState(kind);
    setExportFormat("csv");
    setExportFilter("");
  }

  function confirmExport() {
    if (!exportKindState) return;
    const kind = exportKindState;
    if (exportFormat === "csv") {
      const file = `${kind.key}.csv`;
      downloadTextFile(file, toCsv([kind.headers, ...exportRows]));
      logJob(kind.label, "export", file, exportRows.length);
    } else {
      const objects = exportRows.map((r) => Object.fromEntries(kind.headers.map((h, i) => [h, r[i]])));
      const file = `${kind.key}.json`;
      downloadTextFile(file, JSON.stringify(objects, null, 2), "application/json;charset=utf-8");
      logJob(kind.label, "export", file, exportRows.length);
    }
    setExportKindState(null);
  }

  async function importKind(kind: DataKind, file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    const header = parsed[0] ?? [];
    const dataRows = parsed.slice(1);
    const headerOk =
      header.length === kind.headers.length &&
      header.every((h, i) => h.trim().toLowerCase() === kind.headers[i].toLowerCase());
    let valid = 0;
    let invalid = 0;
    for (const r of dataRows) {
      if (r.length === kind.headers.length && r.every((c) => c.trim() !== "")) valid += 1;
      else invalid += 1;
    }
    setImportResult({ kind, fileName: file.name, header, headerOk, valid, invalid, preview: dataRows.slice(0, 5) });
  }

  function confirmImport() {
    if (!importResult) return;
    logJob(importResult.kind.label, "import", importResult.fileName, importResult.valid);
    setImportResult(null);
  }

  return (
    <div>
      <PageHeader
        title="Import / Export Engine"
        description="Pusat impor & ekspor data — Daily Sales, Cost, Invoice, dan Master Data dalam format CSV."
        breadcrumbs={[{ label: "Master Data" }, { label: "Import/Export" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={canManage ? "Akses impor & ekspor" : "Hanya ekspor"} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Ekspor menghasilkan template CSV berisi data contoh. Impor membaca file CSV dan mencatat job (mock).</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {DATA_KINDS.map((kind) => {
            const Icon = kind.icon;
            return (
              <Card key={kind.key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {kind.label}
                  </CardTitle>
                  <CardDescription>Kolom: {kind.headers.join(", ")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openExport(kind)}>
                    <Download className="h-4 w-4" />
                    Ekspor
                  </Button>
                  <input
                    ref={(el) => {
                      fileRefs.current[kind.key] = el;
                    }}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importKind(kind, f);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={!canManage} onClick={() => fileRefs.current[kind.key]?.click()}>
                    <Upload className="h-4 w-4" />
                    Impor CSV
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Riwayat Job Import/Export
            </CardTitle>
            <CardDescription>Catatan aktivitas impor & ekspor pada sesi ini.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Belum ada job.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Waktu</th>
                      <th className="px-3 py-2 text-left font-medium">Data</th>
                      <th className="px-3 py-2 text-left font-medium">Arah</th>
                      <th className="px-3 py-2 text-left font-medium">File</th>
                      <th className="px-3 py-2 text-right font-medium">Baris</th>
                      <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium tabular-nums">{j.at}</td>
                        <td className="px-3 py-2 text-muted-foreground">{j.kind}</td>
                        <td className="px-3 py-2">
                          <Badge variant={j.direction === "export" ? "info" : "success"}>
                            {j.direction === "export" ? "Ekspor" : "Impor"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{j.file}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(j.rows)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{j.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={exportKindState !== null}
        onClose={() => setExportKindState(null)}
        title="Ekspor Data"
        description={exportKindState ? exportKindState.label : undefined}
        className="max-w-2xl"
        footer={
          exportKindState && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setExportKindState(null)}>
                Batal
              </Button>
              <Button size="sm" disabled={exportRows.length === 0} onClick={confirmExport}>
                <Download className="h-4 w-4" />
                Unduh {exportFormat.toUpperCase()} ({exportRows.length})
              </Button>
            </div>
          )
        }
      >
        {exportKindState && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Format</span>
              {(["csv", "json"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setExportFormat(f)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    exportFormat === f ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {f.toUpperCase()}
                </button>
              ))}
              <input
                type="search"
                value={exportFilter}
                onChange={(e) => setExportFilter(e.target.value)}
                placeholder="Filter baris…"
                className="ml-auto h-7 w-40 rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {exportKindState.headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportRows.length === 0 && (
                    <tr>
                      <td colSpan={exportKindState.headers.length} className="px-2 py-4 text-center text-muted-foreground">
                        Tidak ada baris cocok filter.
                      </td>
                    </tr>
                  )}
                  {exportRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {exportKindState!.headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1.5 tabular-nums">{String(r[ci] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {exportRows.length} dari {exportKindState.sampleRows.length} baris akan diekspor.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={importResult !== null}
        onClose={() => setImportResult(null)}
        title="Validasi Impor"
        description={importResult ? `${importResult.kind.label} · ${importResult.fileName}` : undefined}
        className="max-w-2xl"
        footer={
          importResult && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportResult(null)}>
                Batal
              </Button>
              <Button size="sm" disabled={importResult.valid === 0} onClick={confirmImport}>
                <Upload className="h-4 w-4" />
                Impor {importResult.valid} baris
              </Button>
            </div>
          )
        }
      >
        {importResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Valid</div>
                <div className="text-lg font-semibold text-emerald-700 tabular-nums">{importResult.valid}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Invalid</div>
                <div className="text-lg font-semibold text-rose-700 tabular-nums">{importResult.invalid}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Header</div>
                <Badge variant={importResult.headerOk ? "success" : "danger"} className="mt-1">
                  {importResult.headerOk ? "Cocok" : "Tidak cocok"}
                </Badge>
              </div>
            </div>

            {!importResult.headerOk && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                Kolom diharapkan: <b>{importResult.kind.headers.join(", ")}</b>. Baris tidak sesuai akan diabaikan.
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {importResult.kind.headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importResult.preview.length === 0 && (
                    <tr>
                      <td colSpan={importResult.kind.headers.length} className="px-2 py-4 text-center text-muted-foreground">
                        Tidak ada baris data.
                      </td>
                    </tr>
                  )}
                  {importResult.preview.map((r, i) => {
                    const ok = r.length === importResult.kind.headers.length && r.every((c) => c.trim() !== "");
                    return (
                      <tr key={i} className={cn("border-b last:border-0", !ok && "bg-rose-50")}>
                        {importResult.kind.headers.map((_, ci) => (
                          <td key={ci} className="px-2 py-1.5 tabular-nums">{r[ci] ?? "—"}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">Menampilkan {importResult.preview.length} baris pertama.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
