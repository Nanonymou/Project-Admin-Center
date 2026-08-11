"use client";

import { useMemo } from "react";
import { Landmark, Percent, GitCommitVertical } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { listTaxTypes, TAX_CATEGORY_META } from "@/lib/mock/tax-master";

const pct = (f: number) => `${(f * 100).toFixed((f * 100) % 1 === 0 ? 0 : 1)}%`;

/**
 * Master Tax Engine — the config-driven catalogue of tax types (PPN, PB1, PPh,
 * PPD, …) with rates and versions. Taxes are defined centrally and activated per
 * project. Read-only list here; add/edit rate, version history, and per-project
 * config are layered on by later tasks. Persona-scoped.
 */
export function MasterTaxClient() {
  const { persona } = usePersona();
  const taxes = listTaxTypes();

  const activeCount = useMemo(() => taxes.filter((t) => t.active).length, [taxes]);

  return (
    <div>
      <PageHeader
        title="Master Tax Engine"
        description="Katalog jenis pajak (config-driven) yang dapat diaktifkan per project."
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Tax" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${taxes.length} jenis pajak`} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{taxes.length} jenis</Badge>
          <Badge variant="success">{activeCount} aktif</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Daftar Jenis Pajak
            </CardTitle>
            <CardDescription>Tarif dan kategori pajak yang tersedia di sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Jenis Pajak</th>
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Tarif</th>
                    <th className="px-3 py-2 font-medium">Versi</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.map((t) => {
                    const cat = TAX_CATEGORY_META[t.category];
                    return (
                      <tr key={t.code} className={`border-b last:border-b-0 ${t.active ? "" : "opacity-50"}`}>
                        <td className="px-3 py-2 font-medium">
                          {t.label}
                          <div className="font-mono text-[11px] text-muted-foreground">{t.code}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="info" className="gap-1">
                            <Percent className="h-3 w-3" />
                            {pct(t.rate)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="gap-1">
                            <GitCommitVertical className="h-3 w-3" />v{t.version}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={t.active ? "success" : "muted"}>{t.active ? "Aktif" : "Nonaktif"}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
