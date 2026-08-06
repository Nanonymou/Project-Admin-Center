"use client";

import { useMemo, useState } from "react";
import { Database, DownloadCloud, HardDrive, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import {
  buildBackups,
  BACKUP_STATUS_META,
  type BackupSnapshot,
} from "@/lib/mock/backups";
import { downloadTextFile } from "@/lib/csv";
import { formatNumber } from "@/lib/utils";

export function BackupRestoreClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "leader_admin" || persona.role === "super_admin";

  const seeded = useMemo(() => buildBackups(), []);
  const [added, setAdded] = useState<BackupSnapshot[]>([]);
  const backups = useMemo(() => [...added, ...seeded], [added, seeded]);

  type RestoreEvent = { id: string; backupId: string; scope: string; at: string; by: string };
  const [restoreHistory, setRestoreHistory] = useState<RestoreEvent[]>([]);

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
                                onClick={() => restoreBackup(b)}
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
      </div>
    </div>
  );
}
