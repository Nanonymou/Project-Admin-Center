"use client";

import { useMemo, useRef, useState } from "react";
import { Database, Download, DownloadCloud, HardDrive, Plus, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import {
  buildBackups,
  BACKUP_STATUS_META,
  type BackupSnapshot,
} from "@/lib/mock/backups";
import { downloadTextFile, toCsv, parseCsv } from "@/lib/csv";
import { PROJECT_OPTIONS } from "@/lib/mock/filters";
import { getInvoicePeriodType } from "@/lib/mock/cutoff-config";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { getMarginModel } from "@/lib/mock/margin-model";
import { formatNumber } from "@/lib/utils";

export function BackupRestoreClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "leader_admin" || persona.role === "super_admin";

  const seeded = useMemo(() => buildBackups(), []);
  const [added, setAdded] = useState<BackupSnapshot[]>([]);
  const backups = useMemo(() => [...added, ...seeded], [added, seeded]);

  type LogEntry = { id: string; time: string; text: string };
  const [activityLog, setActivityLog] = useState<LogEntry[]>(() =>
    seeded.slice(0, 6).map((b) => ({
      id: `log-${b.id}`,
      time: b.createdAt,
      text: `Backup ${b.type === "manual" ? "manual" : "otomatis"} "${b.scope}" oleh ${b.createdBy}`,
    })),
  );

  function logActivity(text: string) {
    setActivityLog((prev) => [
      { id: `log-${Date.now()}`, time: new Date().toLocaleTimeString("id-ID"), text },
      ...prev,
    ]);
  }

  type RestoreEvent = { id: string; backupId: string; scope: string; at: string; by: string };
  const [restoreHistory, setRestoreHistory] = useState<RestoreEvent[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [ack, setAck] = useState(false);

  function openRestore(b: BackupSnapshot) {
    setRestoreTarget(b);
    setAck(false);
  }

  function confirmRestore() {
    if (!restoreTarget || !ack) return;
    restoreBackup(restoreTarget);
    setRestoreTarget(null);
    setAck(false);
  }

  function restoreBackup(b: BackupSnapshot) {
    const now = new Date();
    setRestoreHistory((prev) => [
      {
        id: `rst-${Date.now()}`,
        backupId: b.id,
        scope: b.scope,
        at: now.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        by: persona.roleLabel,
      },
      ...prev,
    ]);
    logActivity(`Restore data dari ${b.id} (${b.scope})`);
  }

  const stats = useMemo(() => {
    const completed = backups.filter((b) => b.status === "completed");
    return {
      total: backups.length,
      last: backups[0]?.createdAt ?? "—",
      sizeMb: completed.reduce((s, b) => s + b.sizeMb, 0),
    };
  }, [backups]);

  function downloadBackup(b: BackupSnapshot) {
    const manifest = {
      backupId: b.id,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      type: b.type,
      scope: b.scope,
      sizeMb: b.sizeMb,
      records: b.records,
      status: b.status,
      note: "Mock backup manifest — data tiruan Project Admin Center.",
    };
    downloadTextFile(`${b.id}.json`, JSON.stringify(manifest, null, 2), "application/json;charset=utf-8");
  }

  // Master-data export/import (mock).
  const masterFileRef = useRef<HTMLInputElement>(null);
  const [ioMessage, setIoMessage] = useState<string | null>(null);

  const masterData = useMemo(
    () =>
      PROJECT_OPTIONS.map((p) => ({
        code: p.code,
        name: p.name,
        invoicePeriod: getInvoicePeriodType(p.code),
        tax: getTaxConfig(p.code),
        marginModel: getMarginModel(p.code),
      })),
    [],
  );

  function exportMasterJson() {
    downloadTextFile("master-data.json", JSON.stringify(masterData, null, 2), "application/json;charset=utf-8");
    setIoMessage(`Master data ${masterData.length} project diekspor (JSON).`);
    logActivity("Ekspor master data (JSON)");
  }

  function exportMasterCsv() {
    const header = ["code", "name", "invoicePeriod", "taxCode", "taxRate", "marginModel"];
    const rows = masterData.map((m) => [m.code, m.name, m.invoicePeriod, m.tax.code, m.tax.rate, m.marginModel]);
    downloadTextFile("master-data.csv", toCsv([header, ...rows]));
    setIoMessage(`Master data ${masterData.length} project diekspor (CSV).`);
    logActivity("Ekspor master data (CSV)");
  }

  async function importMaster(file: File) {
    const text = await file.text();
    let count = 0;
    if (file.name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(text);
        count = Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        setIoMessage("File JSON tidak valid.");
        return;
      }
    } else {
      count = Math.max(0, parseCsv(text).length - 1);
    }
    setIoMessage(`${count} entri master data terbaca dari ${file.name} (mock — tidak diterapkan).`);
    logActivity(`Impor master data dari ${file.name}`);
  }

  function createBackup() {
    const now = new Date();
    setAdded((prev) => [
      {
        id: `bkp-manual-${Date.now()}`,
        createdAt: now.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        createdBy: persona.roleLabel,
        type: "manual",
        scope: "Seluruh Project",
        sizeMb: Math.round((60 + Math.random() * 120) * 10) / 10,
        status: "completed",
        records: 5000 + Math.round(Math.random() * 4000),
      },
      ...prev,
    ]);
    logActivity(`Backup manual "Seluruh Project" oleh ${persona.roleLabel}`);
  }

  return (
    <div>
      <PageHeader
        title="Backup & Restore"
        description="Kelola snapshot data — backup terjadwal otomatis dan restore manual (mock)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Backup & Restore" }]}
        actions={
          canManage && (
            <Button size="sm" onClick={createBackup}>
              <Plus className="h-4 w-4" />
              Buat Backup Manual
            </Button>
          )
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={canManage ? "Akses kelola backup" : "Hanya-baca"} />

        {!canManage && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Peran <b>{persona.roleLabel}</b> tidak dapat membuat atau memulihkan backup. Tampilan hanya-baca.
            </span>
          </div>
        )}

        {ioMessage && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <span>{ioMessage}</span>
            <button type="button" onClick={() => setIoMessage(null)} className="text-sky-700 hover:underline">
              Tutup
            </button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ekspor / Impor Master Data</CardTitle>
            <CardDescription>Unduh konfigurasi master project atau impor dari file (mock).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportMasterJson}>
              <Download className="h-4 w-4" />
              Ekspor JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportMasterCsv}>
              <Download className="h-4 w-4" />
              Ekspor CSV
            </Button>
            <input
              ref={masterFileRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importMaster(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage}
              onClick={() => masterFileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Impor Master Data
            </Button>
            <span className="text-[11px] text-muted-foreground">{masterData.length} project dalam master</span>
          </CardContent>
        </Card>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Total Backup" value={stats.total} format="number" icon={Database} tone="primary" />
          <KpiCard label="Total Ukuran" value={`${formatNumber(Math.round(stats.sizeMb))} MB`} format="text" icon={HardDrive} tone="info" />
          <KpiCard label="Backup Terakhir" value={stats.last} format="text" icon={DownloadCloud} tone="success" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Backup</CardTitle>
            <CardDescription>Snapshot otomatis harian & backup manual.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Waktu</th>
                    <th className="px-3 py-2 text-left font-medium">Tipe</th>
                    <th className="px-3 py-2 text-left font-medium">Scope</th>
                    <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    <th className="px-3 py-2 text-right font-medium">Records</th>
                    <th className="px-3 py-2 text-right font-medium">Ukuran</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => {
                    const meta = BACKUP_STATUS_META[b.status];
                    return (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium tabular-nums">{b.createdAt}</td>
                        <td className="px-3 py-2">
                          <Badge variant={b.type === "manual" ? "info" : "muted"}>
                            {b.type === "manual" ? "Manual" : "Otomatis"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{b.scope}</td>
                        <td className="px-3 py-2 text-muted-foreground">{b.createdBy}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatNumber(b.records)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{b.sizeMb} MB</td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {b.status === "completed" ? (
                            <div className="inline-flex items-center gap-2">
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadBackup(b)}>
                                <DownloadCloud className="h-3.5 w-3.5" />
                                Unduh
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                disabled={!canManage}
                                onClick={() => openRestore(b)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Restore</CardTitle>
            <CardDescription>Catatan pemulihan data dari snapshot backup pada sesi ini.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {restoreHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Belum ada aktivitas restore.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Waktu</th>
                      <th className="px-3 py-2 text-left font-medium">Backup ID</th>
                      <th className="px-3 py-2 text-left font-medium">Scope</th>
                      <th className="px-3 py-2 text-left font-medium">Oleh</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restoreHistory.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium tabular-nums">{r.at}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.backupId}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.by}</td>
                        <td className="px-3 py-2">
                          <Badge variant="success">Dipulihkan</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Log Aktivitas</CardTitle>
            <CardDescription>Jejak backup, restore & ekspor/impor master data.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {activityLog.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-[11px] tabular-nums text-muted-foreground">{a.time}</span>
                  <span className="text-muted-foreground">{a.text}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title="Konfirmasi Restore"
        description={restoreTarget ? `${restoreTarget.id} · ${restoreTarget.scope}` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRestoreTarget(null)}>
              Batal
            </Button>
            <Button size="sm" variant="destructive" disabled={!ack} onClick={confirmRestore}>
              <RotateCcw className="h-4 w-4" />
              Pulihkan Data
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Restore akan <b>menimpa data saat ini</b> dengan snapshot{" "}
              {restoreTarget?.createdAt}. Tindakan ini tidak dapat dibatalkan.
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4" />
            Saya memahami risiko dan ingin melanjutkan.
          </label>
        </div>
      </Dialog>
    </div>
  );
}
