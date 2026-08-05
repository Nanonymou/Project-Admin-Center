"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Save, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { SubmitStatusList } from "@/components/daily-cost/submit-status-list";
import { buildSubmitStatus } from "@/lib/mock/closing-status";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import {
  getCostCategories,
  sumCostEntry,
  validateCostEntry,
  type CostEntryInput,
} from "@/lib/mock/cost-config";
import { cn, formatCurrency } from "@/lib/utils";

type SubmittedEntry = {
  id: string;
  date: string;
  total: number;
  breakdown: { label: string; amount: number }[];
  status: "draft" | "submitted";
};

export function DailyCostClient() {
  const { persona } = usePersona();
  const { activeWorkspace } = useActiveSite();
  const categories = useMemo(
    () => getCostCategories(activeWorkspace.projectCode),
    [activeWorkspace.projectCode],
  );

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<CostEntryInput>({});
  const [touched, setTouched] = useState(false);
  const [entries, setEntries] = useState<SubmittedEntry[]>([]);

  const canCreate = persona.role === "site_admin" || persona.role === "super_admin" || persona.role === "leader_admin";

  // H+1 cut-off: entries can only be for today or yesterday.
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const dateAllowed = date === today || date === yesterday;

  const submitStatus = useMemo(() => {
    const accessible = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    return buildSubmitStatus(accessible);
  }, [persona]);

  const errors = useMemo(() => validateCostEntry(categories, values), [categories, values]);
  const total = useMemo(() => sumCostEntry(categories, values), [categories, values]);
  const formError = errors.find((e) => e.key === "_form");

  function setValue(key: string, raw: string) {
    const num = raw === "" ? NaN : Number(raw);
    setValues((prev) => ({ ...prev, [key]: num }));
  }

  function handleSubmit(status: "draft" | "submitted") {
    setTouched(true);
    if (!dateAllowed || errors.length > 0) return;
    setEntries((prev) => [
      {
        id: `${date}-${Date.now()}`,
        date,
        total,
        status,
        breakdown: categories
          .filter((c) => (values[c.key] || 0) > 0)
          .map((c) => ({ label: c.label, amount: values[c.key] })),
      },
      ...prev,
    ]);
    setValues({});
    setTouched(false);
  }

  return (
    <div>
      <PageHeader
        title="Submit Daily Cost"
        description={`Input pengeluaran harian untuk ${activeWorkspace.projectName} · ${activeWorkspace.locationName}.`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Cost" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={`${activeWorkspace.projectCode} · ${activeWorkspace.locationName}`}
        />

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Aturan Cut-Off <b>H+1</b>: transaksi hanya dapat diinput untuk hari ini ({today}) atau
            kemarin ({yesterday}). Kategori mengikuti konfigurasi project{" "}
            <b>{activeWorkspace.projectCode}</b>.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Form Daily Cost
              </CardTitle>
              <CardDescription>
                Isi nominal per kategori (Rupiah). Kosongkan yang tidak ada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                  <Input
                    type="date"
                    value={date}
                    max={today}
                    min={yesterday}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {touched && !dateAllowed && (
                    <p className="mt-1 text-[11px] text-rose-600">
                      Tanggal di luar aturan H+1 — pilih hari ini atau kemarin.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {categories.map((cat) => {
                  const err = errors.find((e) => e.key === cat.key);
                  return (
                    <div key={cat.key}>
                      <label className="mb-1 flex items-center justify-between text-xs font-medium">
                        <span>{cat.label}</span>
                        {cat.requiresProof && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            perlu bukti
                          </span>
                        )}
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        value={Number.isNaN(values[cat.key]) || values[cat.key] === undefined ? "" : values[cat.key]}
                        onChange={(e) => setValue(cat.key, e.target.value)}
                        className={cn(touched && err && "border-rose-400 focus:ring-rose-400")}
                      />
                      {cat.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{cat.hint}</p>}
                      {touched && err && <p className="mt-0.5 text-[11px] text-rose-600">{err.message}</p>}
                    </div>
                  );
                })}
              </div>

              {touched && formError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError.message}
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canCreate}
                    onClick={() => handleSubmit("draft")}
                  >
                    Simpan Draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canCreate}
                    onClick={() => handleSubmit("submitted")}
                  >
                    <Save className="h-4 w-4" />
                    Submit
                  </Button>
                </div>
              </div>
              {!canCreate && (
                <p className="text-[11px] text-muted-foreground">
                  Peran {persona.roleLabel} tidak memiliki izin input Daily Cost.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entri Terbaru</CardTitle>
              <CardDescription>Data tersimpan di sesi ini (mock).</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  Belum ada entri Daily Cost.
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="rounded-md border p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium tabular-nums">{entry.date}</span>
                        <Badge variant={entry.status === "submitted" ? "success" : "muted"}>
                          {entry.status === "submitted" ? "Submitted" : "Draft"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatCurrency(entry.total)}
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        {entry.breakdown.map((b) => (
                          <li key={b.label} className="flex justify-between">
                            <span>{b.label}</span>
                            <span className="tabular-nums">{formatCurrency(b.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status Submit per Site</CardTitle>
            <CardDescription>
              Progress Daily Closing (Draft → Submitted → Reviewed → Approved → Locked) untuk site
              dalam scope Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <SubmitStatusList rows={submitStatus} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
