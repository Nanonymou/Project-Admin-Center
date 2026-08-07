"use client";

import { useRef, useState } from "react";
import { Database, Download, FileSpreadsheet, Info, Upload, Wallet, ShoppingCart, FileText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
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

  function exportKind(kind: DataKind) {
    const file = `${kind.key}.csv`;
    downloadTextFile(file, toCsv([kind.headers, ...kind.sampleRows]));
    logJob(kind.label, "export", file, kind.sampleRows.length);
  }

  async function importKind(kind: DataKind, file: File) {
    const text = await file.text();
    const rows = Math.max(0, parseCsv(text).length - 1);
    logJob(kind.label, "import", file.name, rows);
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
                  <Button size="sm" variant="outline" onClick={() => exportKind(kind)}>
                    <Download className="h-4 w-4" />
                    Ekspor CSV
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
    </div>
  );
}
