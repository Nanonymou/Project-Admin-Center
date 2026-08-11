"use client";

import { useMemo, useState } from "react";
import { MapPin, ArrowDownWideNarrow, Filter } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildAuditTrail, AUDIT_ACTION_META, type AuditAction, type AuditEntry } from "@/lib/mock/audit-trail";

/**
 * Activity Log — a chronological, append-only record of every action across the
 * sites a persona can see (create / edit / submit / review / approve / lock …).
 * Persona-scoped: a Site Admin sees only their site's activity, a Leader/Super
 * Admin the whole portfolio. Filter by action type and flip the sort order.
 * Frontend-first: driven by the `audit-trail` mock, no backend required.
 */
export function ActivityLogClient() {
  const { persona } = usePersona();

  const accessibleSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const entries = useMemo(() => buildAuditTrail(accessibleSites), [accessibleSites]);

  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");
  const [newestFirst, setNewestFirst] = useState(true);

  const actions = useMemo(() => {
    const set = new Set<AuditAction>(entries.map((e) => e.action));
    return Array.from(set);
  }, [entries]);

  const visible = useMemo(() => {
    const filtered = actionFilter === "all" ? entries : entries.filter((e) => e.action === actionFilter);
    const sorted = [...filtered].sort((a, b) =>
      newestFirst ? a.offsetMinutes - b.offsetMinutes : b.offsetMinutes - a.offsetMinutes,
    );
    return sorted;
  }, [entries, actionFilter, newestFirst]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Jejak aktivitas seluruh site dalam cakupan Anda — siapa melakukan apa dan kapan."
      />
      <PersonaBanner persona={persona} scopeSummary={`${accessibleSites.length} site accessible`} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Riwayat Aktivitas</CardTitle>
              <CardDescription>
                {visible.length} aktivitas · {accessibleSites.length} site
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as "all" | AuditAction)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Filter aksi"
                >
                  <option value="all">Semua aksi</option>
                  {actions.map((a) => (
                    <option key={a} value={a}>
                      {AUDIT_ACTION_META[a].label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setNewestFirst((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent"
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
                {newestFirst ? "Terbaru dulu" : "Terlama dulu"}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada aktivitas.</p>
          ) : (
            <ol className="space-y-3">
              {visible.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityRow({ entry }: { entry: AuditEntry }) {
  const meta = AUDIT_ACTION_META[entry.action];
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <Badge variant={meta.variant} className="mt-0.5 shrink-0">
        {meta.label}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{entry.actor}</span>
          <span className="text-xs text-muted-foreground">· {entry.role}</span>
          <span className={cn("ml-auto text-xs text-muted-foreground")}>{entry.timeLabel}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{entry.detail}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {entry.locationName} · {entry.projectCode}
          </span>
          <span className="truncate">{entry.target}</span>
        </div>
      </div>
    </li>
  );
}
