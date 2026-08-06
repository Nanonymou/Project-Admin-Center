"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn } from "@/lib/utils";

export type NotSubmittedRow = {
  locationId: string;
  locationName: string;
  projectCode: string;
  missingDays: string[]; // ISO dates in the last 7 days without a submission
};

export type SubmissionKind = "sales" | "cost";

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/** Determine which of the last `window` days a site has NOT submitted. */
export function buildNotSubmitted(
  sites: SiteKpi[],
  windowDays = 7,
  kind: SubmissionKind = "sales",
): NotSubmittedRow[] {
  const kindOffset = kind === "cost" ? 101 : 0;
  return sites
    .map((site) => {
      const seed = seedOf(site.locationId) + kindOffset;
      const missing: string[] = [];
      for (let i = 0; i < windowDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // deterministic ~20% missing, biased toward recent days
        if (Math.abs(Math.sin(seed + i * 3)) < 0.22) missing.push(d.toISOString().slice(0, 10));
      }
      return {
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        missingDays: missing,
      };
    })
    .sort((a, b) => b.missingDays.length - a.missingDays.length);
}

export function NotSubmittedWidget({
  sites,
  kind = "sales",
}: {
  sites: SiteKpi[];
  kind?: SubmissionKind;
}) {
  const rows = useMemo(() => buildNotSubmitted(sites, 7, kind), [sites, kind]);
  const withMissing = rows.filter((r) => r.missingDays.length > 0);
  const totalMissing = withMissing.reduce((s, r) => s + r.missingDays.length, 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const title = kind === "cost" ? "Daily Cost Belum Submit" : "Daily Sales Belum Submit";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardX className="h-4 w-4 text-rose-500" />
            {title}
          </CardTitle>
          <CardDescription>Site dengan hari yang belum tersubmit dalam 7 hari terakhir.</CardDescription>
        </div>
        {totalMissing > 0 ? (
          <Badge variant="danger" className="tabular-nums">{totalMissing} hari</Badge>
        ) : (
          <Badge variant="success">Lengkap</Badge>
        )}
      </CardHeader>
      <CardContent>
        {withMissing.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Semua site sudah submit {kind === "cost" ? "Daily Cost" : "Daily Sales"}.
          </div>
        ) : (
          <ul className="divide-y">
            {withMissing.map((r) => {
              const missesToday = r.missingDays.includes(todayIso);
              return (
                <li key={r.locationId} className="flex items-center gap-3 py-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      r.missingDays.length >= 3 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{r.locationName}</span>
                      <span className="text-[11px] text-muted-foreground">· {r.projectCode}</span>
                      {missesToday && (
                        <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-700">
                          termasuk hari ini
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.missingDays.map((d) => (
                        <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                          {new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/site/${r.locationId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Tindak
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
