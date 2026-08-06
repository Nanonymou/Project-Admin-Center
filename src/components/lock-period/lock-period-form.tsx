"use client";

import { useMemo, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PeriodLockRow } from "@/lib/mock/lock-period";
import { cn } from "@/lib/utils";

type Props = {
  rows: PeriodLockRow[];
  canLock: boolean;
  onLock: (ids: string[], reason: string) => void;
};

/**
 * Bulk lock form: pick a period (month) and one/more sites currently open,
 * add a reason, and lock them in one action. Leader/Super Admin only.
 */
export function LockPeriodForm({ rows, canLock, onLock }: Props) {
  const openRows = useMemo(() => rows.filter((r) => r.state === "open"), [rows]);
  const periods = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of openRows) map.set(r.periodKey, r.periodLabel);
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [openRows]);

  const [periodKey, setPeriodKey] = useState<string>(periods[0]?.key ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const eligibleRows = useMemo(
    () => openRows.filter((r) => r.periodKey === periodKey),
    [openRows, periodKey],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(eligibleRows.map((r) => r.id)));
  }

  function submit() {
    setTouched(true);
    if (!canLock || selected.size === 0 || reason.trim().length < 4) return;
    onLock(Array.from(selected), reason.trim());
    setDone(selected.size);
    setSelected(new Set());
    setReason("");
    setTouched(false);
  }

  if (periods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Lock Periode
          </CardTitle>
          <CardDescription>Tidak ada periode terbuka untuk dikunci.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Semua periode dalam scope sudah terkunci.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          Lock Periode
        </CardTitle>
        <CardDescription>Kunci beberapa site sekaligus untuk satu periode.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {done !== null && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            {done} periode berhasil dikunci.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Periode</label>
            <select
              value={periodKey}
              onChange={(e) => {
                setPeriodKey(e.target.value);
                setSelected(new Set());
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Alasan <span className="text-rose-600">*</span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. Closing bulanan final"
              className={cn(touched && reason.trim().length < 4 && "border-rose-400")}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Site terbuka ({eligibleRows.length})
            </span>
            <button type="button" onClick={selectAll} className="text-[11px] font-medium text-primary hover:underline">
              Pilih semua
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2">
            {eligibleRows.length === 0 && (
              <span className="text-xs italic text-muted-foreground">
                Tidak ada site terbuka pada periode ini.
              </span>
            )}
            {eligibleRows.map((r) => {
              const active = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    active ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {r.projectCode} · {r.locationName}
                </button>
              );
            })}
          </div>
        </div>

        {touched && selected.size === 0 && (
          <p className="text-[11px] text-rose-600">Pilih minimal satu site.</p>
        )}

        <div className="flex items-center justify-between">
          <Badge variant="muted">{selected.size} site dipilih</Badge>
          <Button size="sm" onClick={submit} disabled={!canLock}>
            <Lock className="h-4 w-4" />
            Kunci Periode
          </Button>
        </div>
        {!canLock && (
          <p className="text-[11px] text-muted-foreground">
            Hanya Leader/Super Admin yang dapat mengunci periode.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
