"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteKpi } from "@/lib/mock/site-kpi";

export type ReopenEvent = {
  id: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  periodLabel: string;
  reason: string;
  approvedBy: string;
  whenLabel: string;
  status: "reopened" | "re_locked";
};

const REASONS = [
  "Koreksi qty Meals Buffet",
  "Penyesuaian harga laundry",
  "Invoice backcharge tertinggal",
  "Revisi food cost",
  "Tambahan Extra Issue",
];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

export function buildReopenEvents(sites: SiteKpi[]): ReopenEvent[] {
  const out: ReopenEvent[] = [];
  for (const site of sites) {
    const seed = seedOf(site.locationId);
    const count = seed % 2 === 0 ? (seed % 3 === 0 ? 2 : 1) : 0;
    for (let i = 0; i < count; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (3 + Math.floor(rand(seed + i) * 25)));
      out.push({
        id: `${site.locationId}-reopen-${i}`,
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        periodLabel: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        reason: REASONS[(seed + i) % REASONS.length],
        approvedBy: (seed + i) % 2 === 0 ? "Leader Admin" : "Super Admin",
        whenLabel: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        status: rand(seed + i + 5) > 0.4 ? "re_locked" : "reopened",
      });
    }
  }
  return out.sort((a, b) => (a.whenLabel < b.whenLabel ? 1 : -1));
}

export function ReopenedPeriodsWidget({ sites }: { sites: SiteKpi[] }) {
  const events = useMemo(() => buildReopenEvents(sites), [sites]);
  const stillOpen = events.filter((e) => e.status === "reopened").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LockOpen className="h-4 w-4 text-amber-600" />
            Periode Dibuka Kembali
          </CardTitle>
          <CardDescription>Riwayat unlock periode oleh Leader/Super Admin.</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{events.length}</div>
          <div className="text-[11px] text-muted-foreground">{stillOpen} masih terbuka</div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Tidak ada periode yang dibuka kembali.
          </div>
        ) : (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                  <LockOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.periodLabel}</span>
                    <Badge variant={e.status === "reopened" ? "warning" : "success"}>
                      {e.status === "reopened" ? "Masih Terbuka" : "Sudah Di-lock Lagi"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{e.reason}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{e.projectCode} · {e.locationName}</span>
                    <span>·</span>
                    <span>oleh {e.approvedBy}</span>
                    <span>·</span>
                    <span>{e.whenLabel}</span>
                  </div>
                </div>
                <Link href={`/site/${e.locationId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Detail
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
