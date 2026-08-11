"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MapPin, Users, Building2, LayoutGrid, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { NAV_SECTIONS } from "@/lib/mock/nav";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { listManagedUsers } from "@/lib/mock/rbac";
import { listCustomerVendors } from "@/lib/mock/customer-vendor";

type ResultKind = "page" | "site" | "user" | "party";

type InfoChip = { label: string; tone?: "success" | "warning" | "danger" | "muted" };

type SearchResult = {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  href: string;
  /** Concise per-type info shown as small chips on the result. */
  info: InfoChip[];
};

const CHIP_TONE: Record<NonNullable<InfoChip["tone"]>, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-800",
  muted: "bg-muted text-muted-foreground",
};

const KIND_META: Record<ResultKind, { label: string; icon: typeof Search; variant: "info" | "success" | "warning" | "muted" }> = {
  page: { label: "Halaman", icon: LayoutGrid, variant: "info" },
  site: { label: "Site", icon: MapPin, variant: "success" },
  user: { label: "Pengguna", icon: Users, variant: "warning" },
  party: { label: "Customer/Vendor", icon: Building2, variant: "muted" },
};

/**
 * Pencarian Global — a single search across the app's entities: pages (nav),
 * sites, managed users, and customer/vendor parties. Persona-scoped (only
 * accessible sites appear) and frontend-first over the config mocks. Results are
 * grouped by kind and link to the relevant destination.
 */
export function GlobalSearchClient() {
  const { persona } = usePersona();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const index = useMemo<SearchResult[]>(() => {
    const out: SearchResult[] = [];

    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        out.push({
          id: `page-${item.href}`,
          kind: "page",
          title: item.label,
          subtitle: `${section.label} · ${item.href}`,
          href: item.href,
          info: [{ label: section.label, tone: "muted" }],
        });
      }
    }

    for (const s of SITE_KPI.filter((x) => canAccessLocation(persona, x.locationId, x.projectCode))) {
      out.push({
        id: `site-${s.locationId}`,
        kind: "site",
        title: `${s.locationName}`,
        subtitle: `${s.projectName} · ${s.projectCode}`,
        href: `/site/${s.locationId}`,
        info: [
          { label: `Margin ${s.marginPct.toFixed(0)}%`, tone: s.marginPct >= 50 ? "success" : "warning" },
          { label: `SLA ${s.slaPct.toFixed(0)}%`, tone: s.slaPct >= 90 ? "success" : "warning" },
          ...(s.overdueInvoices > 0 ? [{ label: `${s.overdueInvoices} overdue`, tone: "danger" as const }] : []),
        ],
      });
    }

    if (persona.capabilities.canConfigure) {
      for (const u of listManagedUsers()) {
        out.push({
          id: `user-${u.id}`,
          kind: "user",
          title: u.name,
          subtitle: `${u.email} · ${u.role}`,
          href: `/hak-akses?user=${u.id}`,
          info: [
            { label: u.role, tone: "muted" },
            { label: u.status, tone: u.status === "active" ? "success" : u.status === "invited" ? "warning" : "danger" },
          ],
        });
      }
    }

    for (const p of listCustomerVendors()) {
      out.push({
        id: `party-${p.id}`,
        kind: "party",
        title: p.name,
        subtitle: `${p.code} · ${p.category}`,
        href: `/master-customer-vendor?code=${encodeURIComponent(p.code)}`,
        info: [
          { label: p.type === "customer" ? "Customer" : "Vendor", tone: "muted" },
          { label: p.status === "active" ? "Aktif" : "Nonaktif", tone: p.status === "active" ? "success" : "danger" },
          { label: p.city, tone: "muted" },
        ],
      });
    }

    return out;
  }, [persona]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((r) => `${r.title} ${r.subtitle}`.toLowerCase().includes(q)).slice(0, 50);
  }, [index, query]);

  const grouped = useMemo(() => {
    const map = new Map<ResultKind, SearchResult[]>();
    for (const r of results) map.set(r.kind, [...(map.get(r.kind) ?? []), r]);
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pencarian Global"
        description="Cari halaman, site, pengguna, dan customer/vendor dalam satu tempat."
      />
      <PersonaBanner persona={persona} scopeSummary="Pencarian dalam cakupan Anda" />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter opens the top result's detail page.
            if (e.key === "Enter" && results.length > 0) router.push(results[0].href);
          }}
          placeholder="Ketik untuk mencari halaman, site, invoice, PIC…"
          className="h-12 w-full rounded-lg border bg-background pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {results.length > 0 && (
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-[11px] text-muted-foreground md:inline-flex">
            <kbd className="rounded border bg-muted px-1.5 py-0.5">Enter</kbd> buka teratas
          </span>
        )}
      </div>

      {query.trim() === "" ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Mulai mengetik untuk mencari di seluruh aplikasi.
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Tidak ada hasil untuk “{query}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([kind, items]) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <div key={kind}>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {meta.label}
                  <Badge variant={meta.variant} className="ml-1">
                    {items.length}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {items.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.href}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                          {r.info.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.info.map((chip, i) => (
                                <span
                                  key={i}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP_TONE[chip.tone ?? "muted"]}`}
                                >
                                  {chip.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
