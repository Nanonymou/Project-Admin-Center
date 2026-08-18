"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Lock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import { getSiteDetail, type InvoiceStatus } from "@/lib/mock/site-detail";
import {
  buildSiteApprovalTimelines,
  type InvoiceTimeline,
  type TimelineStage,
  type TimelineStageState,
} from "@/lib/mock/approval-timeline";
import { APPROVAL_STAGES, type ApprovalStageName } from "@/lib/mock/approval-progress";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

/** SLA (days) and default actor per approval stage — used to fill DB gaps. */
const STAGE_SLA: Record<ApprovalStageName, number> = {
  "Verifikasi Site": 2,
  "Approval Leader": 3,
  "Verifikasi Finance": 3,
  "Kirim Client": 2,
  Payment: 30,
};
const STAGE_ACTOR: Record<ApprovalStageName, string> = {
  "Verifikasi Site": "Site Admin",
  "Approval Leader": "Leader Admin",
  "Verifikasi Finance": "Finance HO",
  "Kirim Client": "Site Admin",
  Payment: "Finance Client",
};

const DAY_MS = 86_400_000;

type DbApproval = {
  subjectId: string;
  currentStage: string;
  status: string;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt?: string | null;
};
type DbHistory = { toStage: string; actor: string; createdAt: string };

/**
 * Map one DB approval (+ its stage history) to the Gantt `InvoiceTimeline` the
 * view renders. Stage vocabulary already matches `APPROVAL_STAGES`; per-stage
 * durations come from the history timestamps when present, otherwise the stage
 * SLA. The subject id is `${locationId}-${invoiceNumber}`, so the location
 * prefix is stripped for display and to join the invoice amount.
 */
function mapDbTimeline(
  approval: DbApproval,
  history: DbHistory[],
  locationId: string,
  amountByNumber: Map<string, number>,
): InvoiceTimeline {
  const stageNames = APPROVAL_STAGES;
  const currentStage = (stageNames as readonly string[]).includes(approval.currentStage)
    ? (approval.currentStage as ApprovalStageName)
    : stageNames[0];
  const currentIdx = Math.max(0, stageNames.indexOf(currentStage));

  const now = Date.now();
  const overdueByDue = approval.dueDate ? new Date(approval.dueDate).getTime() < now : false;
  let status: InvoiceStatus;
  if (approval.status === "completed") status = "onTime";
  else if (approval.status === "rejected" || approval.status === "returned" || overdueByDue) status = "overdue";
  else if (approval.dueDate) {
    const daysToDue = (new Date(approval.dueDate).getTime() - now) / DAY_MS;
    status = daysToDue <= 3 ? "atRisk" : "onTime";
  } else {
    status = "onTime";
  }

  // First time each stage was entered, and the actor who moved it there.
  const enteredAt = new Map<string, number>();
  const actorByStage = new Map<string, string>();
  for (const h of history) {
    if (!enteredAt.has(h.toStage)) enteredAt.set(h.toStage, new Date(h.createdAt).getTime());
    actorByStage.set(h.toStage, h.actor);
  }
  const createdMs = approval.createdAt
    ? new Date(approval.createdAt).getTime()
    : history[0]
      ? new Date(history[0].createdAt).getTime()
      : now;

  let offset = 0;
  const stages: TimelineStage[] = stageNames.map((stage, i) => {
    const sla = STAGE_SLA[stage];
    let state: TimelineStageState;
    if (i < currentIdx) state = "done";
    else if (i === currentIdx) state = status === "overdue" ? "overdue" : "current";
    else state = "upcoming";

    let duration = sla;
    if (i < currentIdx) {
      const startMs = enteredAt.get(stage);
      const nextMs = stageNames[i + 1] ? enteredAt.get(stageNames[i + 1]) : undefined;
      if (startMs && nextMs && nextMs > startMs) duration = Math.max(1, Math.round((nextMs - startMs) / DAY_MS));
    } else if (i === currentIdx) {
      const startMs = enteredAt.get(stage) ?? createdMs;
      duration = Math.max(1, Math.round((now - startMs) / DAY_MS));
    }

    const startOffset = offset;
    if (i <= currentIdx) offset += duration;
    return {
      stage,
      state,
      startOffset,
      durationDays: duration,
      slaDays: sla,
      breachedSla: i <= currentIdx && duration > sla,
      actor: actorByStage.get(stage) ?? approval.assignedTo ?? STAGE_ACTOR[stage],
    };
  });

  const prefix = `${locationId}-`;
  const invoiceNumber = approval.subjectId.startsWith(prefix)
    ? approval.subjectId.slice(prefix.length)
    : approval.subjectId;

  return {
    invoiceNumber,
    amount: amountByNumber.get(invoiceNumber) ?? 0,
    pic: approval.assignedTo ?? STAGE_ACTOR[currentStage],
    status,
    currentStage,
    totalElapsedDays: offset,
    stages,
  };
}

const STATE_COLOR: Record<string, string> = {
  done: "bg-emerald-500",
  current: "bg-primary",
  overdue: "bg-rose-500",
  upcoming: "bg-muted-foreground/30",
};

export function ApprovalTimelineClient({ locationId }: { locationId: string }) {
  const { persona } = usePersona();
  const router = useRouter();
  const detail = getSiteDetail(locationId);
  if (!detail) notFound();

  const inScope = canAccessLocation(persona, detail.site.locationId, detail.site.projectCode);
  const mockTimelines = useMemo(() => buildSiteApprovalTimelines(detail), [detail]);

  const projectCode = detail.site.projectCode;

  // Live approval timelines from the DB, remapped to the Gantt shape.
  const [dbTimelines, setDbTimelines] = useState<InvoiceTimeline[] | null>(null);
  const [live, setLive] = useState(false);

  const loadTimelines = useCallback(async () => {
    try {
      // Fetch approval timelines and invoice amounts (for the value column) together.
      const [tlRes, invRes] = await Promise.all([
        fetch(`/api/approvals/timeline?locationId=${encodeURIComponent(locationId)}&scope=tenant`, {
          headers: personaHeaders(persona.id),
          cache: "no-store",
        }),
        fetch(
          `/api/invoices?locationId=${encodeURIComponent(locationId)}&projectId=${encodeURIComponent(projectCode)}&scope=tenant`,
          { headers: personaHeaders(persona.id), cache: "no-store" },
        ),
      ]);
      if (!tlRes.ok) {
        setDbTimelines(null);
        setLive(false);
        return;
      }
      const tlData = (await tlRes.json()) as {
        source?: string;
        timelines?: Array<{ approval: DbApproval; history: DbHistory[] }>;
      };
      const amountByNumber = new Map<string, number>();
      if (invRes.ok) {
        const invData = (await invRes.json()) as {
          source?: string;
          invoices?: Array<{ number: string; amount: number }>;
        };
        if (Array.isArray(invData.invoices)) {
          for (const inv of invData.invoices) amountByNumber.set(inv.number, Number(inv.amount) || 0);
        }
      }
      if (tlData.source === "db" && Array.isArray(tlData.timelines) && tlData.timelines.length > 0) {
        setDbTimelines(
          tlData.timelines.map((t) => mapDbTimeline(t.approval, t.history ?? [], locationId, amountByNumber)),
        );
        setLive(true);
      } else {
        setDbTimelines(null);
        setLive(false);
      }
    } catch {
      setDbTimelines(null);
      setLive(false);
    }
  }, [locationId, projectCode, persona.id]);

  useEffect(() => {
    void loadTimelines();
  }, [loadTimelines]);

  const timelines = dbTimelines ?? mockTimelines;

  const maxSpan = useMemo(
    () => Math.max(1, ...timelines.map((t) => t.stages.reduce((m, s) => Math.max(m, s.startOffset + s.durationDays), 0))),
    [timelines],
  );

  if (!inScope) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div className="text-lg font-semibold">Akses Ditolak</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Timeline approval site {detail.site.projectCode} · {detail.site.locationName} berada di
              luar scope peran <b>{persona.roleLabel}</b>.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/approvals")}>
              Kembali ke Approval Progress
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Timeline Approval — ${detail.site.projectCode} · ${detail.site.locationName}`}
        description="Alur waktu tiap invoice melalui tahapan approval (gaya Gantt)."
        breadcrumbs={[
          { label: "Operasional" },
          { label: "Approval Progress" },
          { label: detail.site.locationName },
        ]}
        actions={
          <>
            <Link href="/approvals">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>
            </Link>
            <Link href={`/site/${detail.site.locationId}`}>
              <Button size="sm" variant="outline">
                <Building2 className="h-4 w-4" />
                Site Dashboard
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${detail.site.projectCode} · ${detail.site.locationName}`} />

        {live && (
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Timeline approval diambil langsung dari database.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Legenda</CardTitle>
            <CardDescription>Warna menunjukkan status tiap tahap dalam alur approval.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-xs">
            <LegendItem color="bg-emerald-500" label="Selesai" />
            <LegendItem color="bg-primary" label="Berjalan" />
            <LegendItem color="bg-rose-500" label="Overdue" />
            <LegendItem color="bg-muted-foreground/30" label="Belum mulai" />
            <span className="text-muted-foreground">Garis putus-putus = SLA tahap terlampaui.</span>
          </CardContent>
        </Card>

        {timelines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Tidak ada invoice dalam alur approval untuk site ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {timelines.map((t) => (
              <TimelineRow key={t.invoiceNumber} timeline={t} maxSpan={maxSpan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ timeline, maxSpan }: { timeline: InvoiceTimeline; maxSpan: number }) {
  const statusVariant =
    timeline.status === "overdue" ? "danger" : timeline.status === "atRisk" ? "warning" : "success";
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={invoiceHref(timeline.invoiceNumber)}
              className="text-sm font-medium tabular-nums text-primary hover:underline"
            >
              {timeline.invoiceNumber}
            </Link>
            <Badge variant={statusVariant}>{timeline.currentStage}</Badge>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatCurrency(timeline.amount)}</span>
            <span>· PIC {timeline.pic}</span>
            <span>· {timeline.totalElapsedDays} hari berjalan</span>
          </div>
        </div>

        <div className="relative">
          <div className="flex h-7 w-full overflow-hidden rounded bg-muted/40">
            {timeline.stages.map((s) => {
              const widthPct = (s.durationDays / maxSpan) * 100;
              if (s.state === "upcoming") {
                return (
                  <div
                    key={s.stage}
                    className="h-full border-r border-background/60 bg-muted-foreground/10"
                    style={{ width: `${widthPct}%` }}
                    title={`${s.stage} (belum mulai)`}
                  />
                );
              }
              return (
                <div
                  key={s.stage}
                  className={cn(
                    "flex h-full items-center overflow-hidden border-r border-background/60 px-1",
                    STATE_COLOR[s.state],
                    s.breachedSla && "outline outline-1 outline-dashed outline-rose-900/40",
                  )}
                  style={{ width: `${widthPct}%` }}
                  title={`${s.stage}: ${s.durationDays} hari (SLA ${s.slaDays}) · ${s.actor}`}
                >
                  <span className="truncate text-[10px] font-medium text-white">{s.stage}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {timeline.stages.map((s) => (
            <span key={s.stage} className="inline-flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-sm", STATE_COLOR[s.state])} />
              {s.stage}: {s.state === "upcoming" ? `SLA ${s.slaDays}h` : `${s.durationDays}h`}
              {s.breachedSla && <span className="font-medium text-rose-600">(SLA lewat)</span>}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", color)} />
      {label}
    </span>
  );
}
