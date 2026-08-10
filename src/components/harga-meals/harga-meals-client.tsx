"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed, MapPin, Tag } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories } from "@/lib/mock/pricing-config";

/**
 * Harga Meals — default price list per site. The site picker chooses a workspace;
 * prices come from the config-driven master pricing (per-location multiplier), so
 * each site shows its own default meal prices without hardcoding. Meal categories
 * (buffet/packmeal/snack/…) are surfaced first; other service categories are
 * shown separately. Read-only view; persona-scoped.
 */
export function HargaMealsClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const categories = useMemo(
    () => (ws ? getPricedCategories(ws.projectCode, ws.locationId).filter((c) => !c.deduction) : []),
    [ws],
  );

  // Meal categories float to the top; everything else is a general service.
  const isMeal = (key: string) =>
    key.startsWith("meals") || key === "snack_box" || key === "air_minum";
  const meals = categories.filter((c) => isMeal(c.key));
  const others = categories.filter((c) => !isMeal(c.key));

  if (!ws) {
    return (
      <div>
        <PageHeader title="Harga Meals" description="Daftar harga default meals per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  function priceTable(rows: typeof categories, emptyLabel: string) {
    if (rows.length === 0) {
      return (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Kategori</th>
              <th className="px-3 py-2 font-medium">Satuan</th>
              <th className="px-3 py-2 text-right font-medium">Harga Default</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium">{c.label}</td>
                <td className="px-3 py-2">
                  <Badge variant="info" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {c.unit}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(c.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Harga Meals"
        description={`Daftar harga default (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Harga Meals" }]}
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
          <Badge variant="default" className="ml-auto">
            {categories.length} kategori
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Harga Meals — {ws.locationName}
            </CardTitle>
            <CardDescription>Harga default kategori meals untuk site ini.</CardDescription>
          </CardHeader>
          <CardContent>{priceTable(meals, "Tidak ada kategori meals untuk site ini.")}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Layanan Lainnya
            </CardTitle>
            <CardDescription>Harga default kategori layanan non-meals.</CardDescription>
          </CardHeader>
          <CardContent>{priceTable(others, "Tidak ada kategori layanan lain.")}</CardContent>
        </Card>
      </div>
    </div>
  );
}
