"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, Search, ToggleRight, ToggleLeft, Hash, Type, List } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listSystemParameters,
  formatParameterValue,
  PARAMETER_GROUPS,
  type ParameterType,
  type SystemParameter,
} from "@/lib/mock/system-parameters";

const TYPE_ICON: Record<ParameterType, typeof Hash> = {
  number: Hash,
  text: Type,
  boolean: ToggleRight,
  select: List,
};

const TYPE_LABEL: Record<ParameterType, string> = {
  number: "Angka",
  text: "Teks",
  boolean: "Ya/Tidak",
  select: "Pilihan",
};

/**
 * Parameter Sistem — global application settings (config-driven), grouped by
 * concern (Umum, Keuangan, Notifikasi, Keamanan, Penyimpanan). These are
 * app-level parameters, distinct from per-project business config. Read-only
 * here; editing, validation, and a change-history panel are layered on by later
 * tasks. Persona-scoped view.
 */
export function ParameterSistemClient() {
  const { persona } = usePersona();
  const [query, setQuery] = useState("");

  const params = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listSystemParameters().filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.key.includes(q),
    );
  }, [query]);

  const byGroup = useMemo(() => {
    const map = new Map<string, SystemParameter[]>();
    for (const g of PARAMETER_GROUPS) map.set(g, []);
    for (const p of params) map.get(p.group)?.push(p);
    return PARAMETER_GROUPS.map((g) => ({ group: g, items: map.get(g) ?? [] })).filter(
      (x) => x.items.length > 0,
    );
  }, [params]);

  return (
    <div>
      <PageHeader
        title="Parameter Sistem"
        description="Pengaturan global aplikasi (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Parameter Sistem" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${listSystemParameters().length} parameter`} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari parameter…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Badge variant="default" className="ml-auto gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            {params.length} parameter
          </Badge>
        </div>

        {byGroup.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Tidak ada parameter yang cocok.
          </div>
        ) : (
          byGroup.map(({ group, items }) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="text-base">{group}</CardTitle>
                <CardDescription>{items.length} parameter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {items.map((p) => {
                    const Icon = p.type === "boolean" && p.value === false ? ToggleLeft : TYPE_ICON[p.type];
                    return (
                      <div key={p.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.label}</span>
                            <Badge variant="muted" className="gap-1">
                              <Icon className="h-3 w-3" />
                              {TYPE_LABEL[p.type]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">{p.key}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {p.type === "boolean" ? (
                            <Badge variant={p.value ? "success" : "muted"}>
                              {formatParameterValue(p, p.value)}
                            </Badge>
                          ) : (
                            <span className="text-sm font-semibold tabular-nums">
                              {formatParameterValue(p, p.value)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
