"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowRight, CheckCircle2, Unlock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCutOffDate } from "@/lib/mock/cutoff-config";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

export type PastCutOffRow = {
  id: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  type: "Daily Sales" | "Daily Cost";
  dataDate: string;
  submittedDate: string;
  daysLate: number;
  amount: number;
  needsUnlock: boolean;
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/** Build a list of entries submitted after their period cut-off. */
export function buildPastCutOff(sites: SiteKpi[]): PastCutOffRow[] {
  const out: PastCutOffRow[] = [];
  for (const site of sites) {
    const seed = seedOf(site.locationId);
    const count = seed % 3; // 0..2 late entries per site
    const cutoff = getCutOffDate(site.projectCode);
    for (let i = 0; i < count; i++) {
      const late = 1 + Math.floor(rand(seed + i) * 6);
      const dataDate = new Date(cutoff);
      dataDate.setDate(dataDate.getDate() - Math.floor(rand(seed + i + 1) * 10));
      const submitted = new Date(cutoff);
      submitted.setDate(submitted.getDate() + late);
      out.push({
        id: `${site.locationId}-late-${i}`,
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        type: i % 2 === 0 ? "Daily Sales" : "Daily Cost",
        dataDate: dataDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        submittedDate: submitted.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        daysLate: late,
        amount: Math.round((site.sales / 30) * (0.3 + rand(seed + i + 2) * 0.5)),
        needsUnlock: late > 2,
      });
    }
  }
  return out.sort((a, b) => b.daysLate - a.daysLate);
}

export function PastCutOffWidget({ sites }: { sites: SiteKpi[] }) {
  const rows = useMemo(() => buildPastCutOff(sites), [sites]);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const pendingUnlock = rows.filter((r) => r.needsUnlock && !resolved.has(r.id)).length;

  function toggle(id: string) {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-rose-500" />
            Data Melewati Cut-Off
          </CardTitle>
          <CardDescription>Entri yang disubmit setelah tenggat closing periode.</CardDescription>
        </div>
        {pendingUnlock > 0 && (
          <Badge variant="danger" className="tabular-nums">{pendingUnlock} butuh unlock</Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Tidak ada data yang melewati cut-off.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Site</th>
                  <th className="px-3 py-2 text-left font-medium">Tipe</th>
                  <th className="px-3 py-2 text-left font-medium">Data / Submit</th>
                  <th className="px-3 py-2 text-right font-medium">Telat</th>
                  <th className="px-3 py-2 text-right font-medium">Nilai</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const done = resolved.has(r.id);
                  return (
                    <tr key={r.id} className={cn("border-b last:border-0 hover:bg-muted/30", done && "opacity-60")}>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium">{r.locationName}</div>
                        <div className="text-[11px] text-muted-foreground">{r.projectCode}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {r.dataDate} → {r.submittedDate}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={r.daysLate > 2 ? "danger" : "warning"} className="tabular-nums">
                          +{r.daysLate}h
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {r.needsUnlock && (
                            <Button
                              size="sm"
                              variant={done ? "default" : "outline"}
                              className="h-7 px-2"
                              onClick={() => toggle(r.id)}
                              title={done ? "Batalkan" : "Tandai di-unlock"}
                            >
                              <Unlock className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Link href={`/site/${r.locationId}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                            Detail
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
