"use client";

import { useMemo, useState } from "react";
import { Coins, Layers, Building2, Tag, Minus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessProject } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES, type Workspace } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";

type ProjectOption = { projectCode: string; projectName: string; locations: Workspace[] };

/**
 * Master Pricing Engine — the central, config-driven price master per project
 * (the source the per-site Harga Meals list derives from). For a project it
 * lists each service category with its base price and the effective price at
 * every location (base × per-location multiplier). Read-only here; add/edit
 * per-project, toggle, and change history are layered on by later tasks.
 * Persona-scoped by project access.
 */
export function MasterPricingClient() {
  const { persona } = usePersona();

  const projects: ProjectOption[] = useMemo(() => {
    const map = new Map<string, ProjectOption>();
    for (const w of MOCK_WORKSPACES) {
      if (!canAccessProject(persona, w.projectCode)) continue;
      const opt = map.get(w.projectCode) ?? {
        projectCode: w.projectCode,
        projectName: w.projectName,
        locations: [],
      };
      opt.locations.push(w);
      map.set(w.projectCode, opt);
    }
    return [...map.values()];
  }, [persona]);

  const [projIndex, setProjIndex] = useState(0);
  const project = projects[projIndex] ?? projects[0];

  const categories = useMemo(
    () => (project ? getServiceCategories(project.projectCode) : []),
    [project],
  );

  if (!project) {
    return (
      <div>
        <PageHeader title="Master Pricing" description="Master harga per proyek." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada proyek dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Master Pricing Engine"
        description="Kontrol pusat harga per proyek (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Pricing" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${projects.length} proyek`} />

        <div className="flex flex-wrap items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Proyek</label>
          <select
            value={projIndex}
            onChange={(e) => setProjIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p, i) => (
              <option key={p.projectCode} value={i}>
                {p.projectName} ({p.projectCode})
              </option>
            ))}
          </select>
          <Badge variant="default" className="ml-auto gap-1">
            <Layers className="h-3 w-3" />
            {categories.length} kategori
          </Badge>
          <Badge variant="info" className="gap-1">
            <Building2 className="h-3 w-3" />
            {project.locations.length} site
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Harga Efektif — {project.projectName}
            </CardTitle>
            <CardDescription>
              Harga dasar per kategori dan harga efektif tiap site (dasar × pengali lokasi).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 font-medium">Satuan</th>
                    <th className="px-3 py-2 text-right font-medium">Harga Dasar</th>
                    {project.locations.map((loc) => (
                      <th key={loc.locationId} className="px-3 py-2 text-right font-medium">
                        {loc.locationName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.key} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">
                        {c.label}
                        {c.deduction && (
                          <Badge variant="danger" className="ml-2 gap-1">
                            <Minus className="h-3 w-3" />
                            Potongan
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="info" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {c.unit}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(c.defaultPrice)}
                      </td>
                      {project.locations.map((loc) => (
                        <td key={loc.locationId} className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrency(getPriceFor(project.projectCode, loc.locationId, c.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
