"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Filter, Search, User, Clock, Target, X, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
import { canViewAuditLog } from "@/lib/mock/access-config";
import {
  buildSystemAuditLog,
  AUDIT_CATEGORY_META,
  type AuditCategory,
  type SystemAuditEntry,
} from "@/lib/mock/audit-log";

/**
 * Audit Log — the system/security audit trail (administrative & configuration
 * events: role changes, master lock/unlock, parameter/pricing/tax edits, user
 * management). Restricted to Leader/Super Admin. Filter by category and search
 * across actor/target/detail. Frontend-first: driven by the `audit-log` mock.
 */
export function AuditLogClient() {
  const { persona } = usePersona();
  const canView = canViewAuditLog(persona.role);

  const entries = useMemo(() => buildSystemAuditLog(), []);
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditCategory>("all");
  const [actorFilter, setActorFilter] = useState<"all" | string>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SystemAuditEntry | null>(null);

  const categories = useMemo(() => Array.from(new Set(entries.map((e) => e.category))), [entries]);
  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor))), [entries]);

  const hasFilters =
    categoryFilter !== "all" || actorFilter !== "all" || timeFilter !== "all" || query.trim() !== "";
  const resetFilters = () => {
    setCategoryFilter("all");
    setActorFilter("all");
    setTimeFilter("all");
    setQuery("");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const windowMs =
      timeFilter === "24h" ? 864e5 : timeFilter === "7d" ? 7 * 864e5 : timeFilter === "30d" ? 30 * 864e5 : Infinity;
    return entries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (actorFilter !== "all" && e.actor !== actorFilter) return false;
      if (windowMs !== Infinity && now - new Date(e.at).getTime() > windowMs) return false;
      if (q && !`${e.actor} ${e.target} ${e.detail} ${e.action}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, categoryFilter, actorFilter, timeFilter, query]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" description="Jejak audit sistem & keamanan." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Audit Log hanya dapat diakses oleh Leader Admin / Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Jejak audit sistem & keamanan — perubahan konfigurasi, role, master lock, dan pengguna."
      />
      <PersonaBanner persona={persona} scopeSummary="Akses penuh audit" />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Jejak Audit
              </CardTitle>
              <CardDescription>{visible.length} peristiwa</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari aktor / target / detail…"
                  className="w-56 rounded-md border bg-background py-1 pl-8 pr-2 text-sm"
                  aria-label="Cari audit"
                />
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as "all" | AuditCategory)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Filter kategori"
                >
                  <option value="all">Semua kategori</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {AUDIT_CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Filter pengguna"
              >
                <option value="all">Semua pengguna</option>
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as "all" | "24h" | "7d" | "30d")}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Filter waktu"
              >
                <option value="all">Semua waktu</option>
                <option value="24h">24 jam terakhir</option>
                <option value="7d">7 hari terakhir</option>
                <option value="30d">30 hari terakhir</option>
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" /> Reset
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada peristiwa audit.</p>
          ) : (
            <ol className="space-y-3">
              {visible.map((entry) => (
                <AuditRow key={entry.id} entry={entry} onSelect={() => setSelected(entry)} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <AuditCompareDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ValueBlock({ label, value, tone }: { label: string; value: string | null; tone: "old" | "new" }) {
  return (
    <div
      className={cn(
        "flex-1 rounded-md border p-3",
        tone === "old" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50",
      )}
    >
      <p className={cn("text-xs font-medium", tone === "old" ? "text-rose-700" : "text-emerald-700")}>{label}</p>
      <p className="mt-1 break-words text-sm">
        {value ?? <span className="italic text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function AuditCompareDialog({ entry, onClose }: { entry: SystemAuditEntry | null; onClose: () => void }) {
  const meta = entry ? AUDIT_CATEGORY_META[entry.category] : null;
  const hasComparison = entry && (entry.before !== null || entry.after !== null);
  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      title="Detail Perubahan"
      description={entry ? entry.detail : undefined}
    >
      {entry && meta && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{entry.action}</code>
            <span className="ml-auto text-xs text-muted-foreground">{entry.relative}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" /> {entry.actor} · {entry.role}
            <Target className="ml-2 h-3.5 w-3.5" /> {entry.target}
          </div>
          {hasComparison ? (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <ValueBlock label="Nilai lama" value={entry.before} tone="old" />
              <ArrowRight className="mx-auto hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              <ValueBlock label="Nilai baru" value={entry.after} tone="new" />
            </div>
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Peristiwa ini tidak memuat perubahan nilai (before/after).
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function AuditRow({ entry, onSelect }: { entry: SystemAuditEntry; onSelect: () => void }) {
  const meta = AUDIT_CATEGORY_META[entry.category];
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
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{entry.action}</code>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {entry.relative}
          </span>
        </div>
        <p className="mt-1 text-sm text-foreground">{entry.detail}</p>
        <div className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground")}>
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {entry.actor} · {entry.role}
          </span>
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" />
            {entry.target}
          </span>
        </div>
      </div>
    </li>
  );
}
