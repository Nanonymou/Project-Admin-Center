"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Filter, Search, User, Clock, Target, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
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
  const canView = persona.role === "leader_admin" || persona.role === "super_admin";

  const entries = useMemo(() => buildSystemAuditLog(), []);
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditCategory>("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => Array.from(new Set(entries.map((e) => e.category))), [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (q && !`${e.actor} ${e.target} ${e.detail} ${e.action}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, categoryFilter, query]);

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
              {(categoryFilter !== "all" || query.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setQuery("");
                  }}
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
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditRow({ entry }: { entry: SystemAuditEntry }) {
  const meta = AUDIT_CATEGORY_META[entry.category];
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
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
