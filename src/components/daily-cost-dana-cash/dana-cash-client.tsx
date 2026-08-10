"use client";

import { useMemo, useState } from "react";
import { Wallet, MapPin, ArrowDownCircle, ArrowUpCircle, PiggyBank, Plus, Pencil, Trash2, History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { AttachmentCenter } from "@/components/attachments/attachment-center";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getCostCategories } from "@/lib/mock/cost-config";
import { buildDanaCashLedger, danaCashOpeningBalance, type DanaCashEntry } from "@/lib/mock/dana-cash";

/**
 * Daily Cost Dana Cash — cash-fund ledger list. Shows the opening balance,
 * top-ups and expenses paid from the site's petty-cash fund, and the running
 * balance per entry. Config-driven per project/location and persona-scoped;
 * seeded from mock data with no backend required.
 */
export function DanaCashClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const canInput =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const opening = ws ? danaCashOpeningBalance(ws.locationId) : 0;
  const seededLedger = useMemo(
    () => (ws ? buildDanaCashLedger(ws.projectCode, ws.locationId) : []),
    [ws],
  );
  const [added, setAdded] = useState<DanaCashEntry[]>([]);
  // Reset session additions when the workspace changes.
  const addedForWs = ws ? added : [];
  const ledger = useMemo(() => {
    const merged = [...seededLedger, ...addedForWs];
    return merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [seededLedger, addedForWs]);

  // Add-transaction form state.
  const categories = useMemo(() => (ws ? getCostCategories(ws.projectCode) : []), [ws]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(todayIso);
  const [formType, setFormType] = useState<"expense" | "top_up">("expense");
  const [formCategory, setFormCategory] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);

  const catKey = formCategory || categories[0]?.key || "misc";

  // Session change log for the history panel.
  type ChangeAction = "add" | "edit" | "delete";
  type ChangeLogRow = { id: string; action: ChangeAction; label: string; amount: number; at: string };
  const [changeLog, setChangeLog] = useState<ChangeLogRow[]>([]);

  function logChange(action: ChangeAction, label: string, amount: number) {
    setChangeLog((prev) => [
      {
        id: `log-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
        action,
        label,
        amount,
        at: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
  }

  function addTransaction() {
    if (!ws || formAmount <= 0) return;
    const cat = categories.find((c) => c.key === catKey);
    const amount = formType === "top_up" ? formAmount : -formAmount;
    const label = formType === "top_up" ? "Top-up Dana Cash" : cat?.label ?? "Pengeluaran";
    const entry: DanaCashEntry = {
      id: `local-${Date.now()}`,
      date: formDate,
      categoryKey: formType === "top_up" ? "top_up" : catKey,
      categoryLabel: label,
      description: formDesc.trim() || (formType === "top_up" ? "Pengisian ulang kas" : "Pengeluaran kas"),
      amount,
      by: persona.roleLabel,
    };
    setAdded((prev) => [...prev, entry]);
    logChange("add", label, amount);
    setFormAmount(0);
    setFormDesc("");
  }

  // Edit dialog (session-added entries only).
  const [editing, setEditing] = useState<DanaCashEntry | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editDesc, setEditDesc] = useState("");

  function openEdit(entry: DanaCashEntry) {
    setEditing(entry);
    setEditAmount(Math.abs(entry.amount));
    setEditDesc(entry.description);
  }

  function saveEdit() {
    if (!editing || editAmount <= 0) return;
    const sign = editing.amount < 0 ? -1 : 1;
    setAdded((prev) =>
      prev.map((e) =>
        e.id === editing.id ? { ...e, amount: sign * editAmount, description: editDesc.trim() || e.description } : e,
      ),
    );
    logChange("edit", editing.categoryLabel, sign * editAmount);
    setEditing(null);
  }

  function deleteEntry(entry: DanaCashEntry) {
    setAdded((prev) => prev.filter((e) => e.id !== entry.id));
    logChange("delete", entry.categoryLabel, entry.amount);
  }

  // Compute the running balance per entry.
  const rows = useMemo(() => {
    let balance = opening;
    return ledger.map((e) => {
      balance += e.amount;
      return { ...e, balance };
    });
  }, [ledger, opening]);

  const totalTopUp = ledger.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalExpense = ledger.filter((e) => e.amount < 0).reduce((s, e) => s + -e.amount, 0);
  const closing = opening + totalTopUp - totalExpense;

  if (!ws) {
    return (
      <div>
        <PageHeader title="Daily Cost Dana Cash" description="Buku kas dana cash per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada workspace dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Daily Cost Dana Cash"
        description="Buku kas dana cash — top-up, pengeluaran, dan saldo berjalan per site."
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Cost Dana Cash" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => {
              setWsIndex(Number(e.target.value));
              setAdded([]);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
        </div>

        {/* Add transaction form */}
        {canInput && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Tambah Transaksi Kas
              </CardTitle>
              <CardDescription>Catat pengeluaran atau top-up dana cash.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Tanggal</span>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value || todayIso)}
                    className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Jenis</span>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "expense" | "top_up")}
                    className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="expense">Pengeluaran</option>
                    <option value="top_up">Top-up</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Kategori</span>
                  <select
                    value={catKey}
                    disabled={formType === "top_up"}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs lg:col-span-1">
                  <span className="text-muted-foreground">Keterangan</span>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Opsional"
                    className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Nominal (Rp)</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={formAmount}
                    onChange={(e) => setFormAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                    {formatCurrency(formAmount)}
                  </span>
                </label>
                <Button onClick={addTransaction} disabled={formAmount <= 0} className="h-9">
                  <Plus className="h-4 w-4" />
                  Tambah
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <PiggyBank className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-lg font-semibold tabular-nums">{formatCurrency(opening)}</div>
                <div className="text-xs text-muted-foreground">Saldo Awal</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-lg font-semibold tabular-nums text-emerald-700">{formatCurrency(totalTopUp)}</div>
                <div className="text-xs text-muted-foreground">Total Top-up</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <ArrowDownCircle className="h-5 w-5 text-rose-600" />
              <div>
                <div className="text-lg font-semibold tabular-nums text-rose-700">{formatCurrency(totalExpense)}</div>
                <div className="text-xs text-muted-foreground">Total Pengeluaran</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <div className="text-lg font-semibold tabular-nums text-primary">{formatCurrency(closing)}</div>
                <div className="text-xs text-muted-foreground">Saldo Akhir</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Buku Kas — {ws.locationName}
            </CardTitle>
            <CardDescription>{rows.length} transaksi kas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                    <th className="px-3 py-2 text-left font-medium">Jenis</th>
                    <th className="px-3 py-2 text-right font-medium">Nominal</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo</th>
                    <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isTopUp = r.amount > 0;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.categoryLabel}</div>
                          <div className="text-[11px] text-muted-foreground">{r.description}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={isTopUp ? "success" : "danger"}>
                            {isTopUp ? "Top-up" : "Keluar"}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums font-medium",
                            isTopUp ? "text-emerald-700" : "text-rose-700",
                          )}
                        >
                          {isTopUp ? "+" : "−"}
                          {formatCurrency(Math.abs(r.amount))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.balance)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.by}</td>
                        <td className="px-3 py-2 text-right">
                          {r.id.startsWith("local-") && canInput ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Ubah">
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteEntry(r)} title="Hapus">
                                <Trash2 className="h-4 w-4 text-rose-500" />
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

        {/* Evidence upload + preview for cash transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bukti Transaksi Kas — {ws.locationName}</CardTitle>
            <CardDescription>
              Unggah bukti pengeluaran/top-up (nota, kwitansi) dan pratinjau langsung.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttachmentCenter
              title="Bukti Dana Cash"
              accept="image/*,.pdf"
              readOnly={!canInput}
            />
          </CardContent>
        </Card>

        {/* Change history panel */}
        {changeLog.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-primary" />
                Riwayat Perubahan (sesi ini)
              </CardTitle>
              <CardDescription>Aksi tambah / ubah / hapus transaksi kas pada sesi ini.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {changeLog.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="tabular-nums text-[11px] text-muted-foreground">{c.at}</span>
                    <Badge
                      variant={c.action === "add" ? "success" : c.action === "edit" ? "info" : "danger"}
                    >
                      {c.action === "add" ? "Tambah" : c.action === "edit" ? "Ubah" : "Hapus"}
                    </Badge>
                    <span className="flex-1 truncate">{c.label}</span>
                    <span
                      className={cn(
                        "tabular-nums font-medium",
                        c.amount < 0 ? "text-rose-700" : "text-emerald-700",
                      )}
                    >
                      {c.amount < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(c.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit transaction dialog */}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Ubah Transaksi Kas"
        description={editing ? editing.categoryLabel : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={editAmount <= 0} onClick={saveEdit}>
              Simpan
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Nominal (Rp)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={editAmount}
                onChange={(e) => setEditAmount(Math.max(0, Number(e.target.value) || 0))}
                className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                {formatCurrency(editAmount)}
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Keterangan</span>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        )}
      </Dialog>
    </div>
  );
}
