"use client";

import { useMemo, useState } from "react";
import { ListChecks, MapPin, Tag, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";

/**
 * Kategori Sales — the config-driven list of sales service categories per
 * project/site (PRD §Master Data / Service Category matrix). Categories are
 * sourced from the service config keyed by project code, so a new project adds
 * categories via config only. Shows each category's unit, type (revenue vs
 * deduction), and the site's effective price from Master Pricing. Persona-scoped.
 */
export function KategoriSalesClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    if (!ws) return [];
    const q = query.trim().toLowerCase();
    return getServiceCategories(ws.projectCode)
      .map((c) => ({ ...c, price: getPriceFor(ws.projectCode, ws.locationId, c.key) }))
      .filter((c) => !q || c.label.toLowerCase().includes(q) || c.key.includes(q));
  }, [ws, query]);

  const revenueCount = categories.filter((c) => !c.deduction).length;
  const deductionCount = categories.filter((c) => c.deduction).length;

  if (!ws) {
    return (
      <div>
        <PageHeader title="Kategori Sales" description="Daftar kategori penjualan per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Kategori Sales"
        description={`Kategori penjualan (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Kategori Sales" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} site`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Site</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectName} — {w.locationName} ({w.projectCode})
              </option>
            ))}
          </select>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kategori…"
            className="h-8 w-44 text-xs"
          />
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {revenueCount} penjualan
            </Badge>
            {deductionCount > 0 && (
              <Badge variant="danger" className="gap-1">
                <TrendingDown className="h-3 w-3" />
                {deductionCount} potongan
              </Badge>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Daftar Kategori — {ws.projectName}
            </CardTitle>
            <CardDescription>
              Kategori layanan penjualan yang aktif untuk project ini, beserta harga master per site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Tidak ada kategori yang cocok.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Kategori</th>
                      <th className="px-3 py-2 font-medium">Kode</th>
                      <th className="px-3 py-2 font-medium">Satuan</th>
                      <th className="px-3 py-2 font-medium">Tipe</th>
                      <th className="px-3 py-2 text-right font-medium">Harga Master</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.key} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium">{c.label}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.key}</td>
                        <td className="px-3 py-2">
                          <Badge variant="info" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {c.unit}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {c.deduction ? (
                            <Badge variant="danger">Potongan</Badge>
                          ) : (
                            <Badge variant="success">Penjualan</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {c.deduction ? "−" : ""}
                          {formatCurrency(c.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
