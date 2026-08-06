"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getInvoicePeriodType, getCutOffDate } from "@/lib/mock/cutoff-config";
import { cn } from "@/lib/utils";

/**
 * Dynamic cut-off input: choose a reference date and the cut-off date + days
 * remaining are recomputed per project from its config (no hardcoded dates).
 */
export function CutOffCalculator({ projectCodes }: { projectCodes: string[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [refDate, setRefDate] = useState(today);

  const rows = useMemo(() => {
    const ref = new Date(refDate + "T00:00:00");
    return projectCodes.map((code) => {
      const cutoff = getCutOffDate(code, ref);
      cutoff.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((cutoff.getTime() - ref.getTime()) / 86_400_000);
      return {
        code,
        type: getInvoicePeriodType(code),
        cutOffLabel: cutoff.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
        daysLeft,
      };
    });
  }, [projectCodes, refDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Kalkulator Cut-Off
        </CardTitle>
        <CardDescription>
          Pilih tanggal acuan — tanggal cut-off & sisa hari dihitung otomatis per project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal Acuan</label>
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value || today)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.code} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.code}</span>
                <Badge variant="muted">{r.type === "15-14" ? "Periode 15–14" : "Periode 1–akhir"}</Badge>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">Cut-off: {r.cutOffLabel}</div>
              <div
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums",
                  r.daysLeft <= 0 ? "text-rose-700" : r.daysLeft <= 2 ? "text-amber-700" : "text-emerald-700",
                )}
              >
                {r.daysLeft <= 0 ? "Sudah lewat" : `H-${r.daysLeft}`}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
