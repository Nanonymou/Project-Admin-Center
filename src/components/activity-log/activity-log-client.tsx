"use client";

import { useMemo, useState } from "react";
import { MapPin, ArrowDownWideNarrow, Filter, Search, X, Clock, User, Target } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
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
  const [locationFilter, setLocationFilter] = useState<"all" | string>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))), [entries]);
  const roles = useMemo(() => Array.from(new Set(entries.map((e) => e.role))), [entries]);
  const locations = useMemo(
    () =>
      Array.from(new Map(accessibleSites.map((s) => [s.locationId, s.locationName])).entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    [accessibleSites],
  );

  const hasFilters =
    actionFilter !== "all" || locationFilter !== "all" || roleFilter !== "all" || query.trim() !== "";

  const resetFilters = () => {
    setActionFilter("all");
    setLocationFilter("all");
    setRoleFilter("all");
    setQuery("");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (locationFilter !== "all" && e.locationId !== locationFilter) return false;
      if (roleFilter !== "all" && e.role !== roleFilter) return false;
      if (q && !`${e.actor} ${e.detail} ${e.target}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      newestFirst ? a.offsetMinutes - b.offsetMinutes : b.offsetMinutes - a.offsetMinutes,
    );
  }, [entries, actionFilter, locationFilter, roleFilter, query, newestFirst]);

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
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari aktor / detail / target…"
                  className="w-56 rounded-md border bg-background py-1 pl-8 pr-2 text-sm"
                  aria-label="Cari aktivitas"
                />
              </div>
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
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Filter peran"
              >
                <option value="all">Semua peran</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {locations.length > 1 && (
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Filter site"
                >
                  <option value="all">Semua site</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setNewestFirst((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent"
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
                {newestFirst ? "Terbaru dulu" : "Terlama dulu"}
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                  Reset
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada aktivitas.</p>
          ) : (
            <ol className="space-y-3">
              {visible.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} onSelect={() => setSelected(entry)} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ActivityDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ActivityDetailDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const meta = entry ? AUDIT_ACTION_META[entry.action] : null;
  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      title="Detail Aktivitas"
      description={entry ? entry.detail : undefined}
    >
      {entry && meta && (
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{entry.timeLabel}</span>
          </div>
          <DetailRow icon={User} label="Aktor">
            {entry.actor} · {entry.role}
          </DetailRow>
          <DetailRow icon={Target} label="Target">
            {entry.target}
          </DetailRow>
          <DetailRow icon={MapPin} label="Lokasi">
            {entry.locationName} · {entry.projectCode}
          </DetailRow>
          <DetailRow icon={Clock} label="Waktu">
            {entry.timeLabel} ({entry.offsetMinutes} menit lalu)
          </DetailRow>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">ID:</span> {entry.id}
          </div>
        </dl>
      )}
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}

function ActivityRow({ entry, onSelect }: { entry: AuditEntry; onSelect: () => void }) {
  const meta = AUDIT_ACTION_META[entry.action];
  return (
    <li
      onClick={onSelect}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
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
