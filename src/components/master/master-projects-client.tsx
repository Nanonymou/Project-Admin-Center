"use client";

import { useMemo } from "react";
import { Building2, MapPin, CalendarClock, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { MOCK_WORKSPACES, type Workspace } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";

type ProjectGroup = {
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  invoicePeriod: string;
  categoryCount: number;
  locations: Workspace[];
};

/**
 * Master Project & Location — the config-driven overview of the
 * Project → Location hierarchy (PRD §Master Data). Projects and their locations
 * are derived from the workspace registry, persona-scoped: a Leader Admin sees
 * every project they own, a Site Admin only their own site. Read-only master
 * view — adding a project/location is a config change, not a code change.
 */
export function MasterProjectsClient() {
  const { persona } = usePersona();

  const groups: ProjectGroup[] = useMemo(() => {
    const accessible = MOCK_WORKSPACES.filter((w) =>
      canAccessLocation(persona, w.locationId, w.projectCode),
    );
    const byProject = new Map<string, ProjectGroup>();
    for (const w of accessible) {
      let g = byProject.get(w.projectId);
      if (!g) {
        g = {
          projectId: w.projectId,
          projectCode: w.projectCode,
          projectName: w.projectName,
          client: w.client,
          invoicePeriod: w.invoicePeriod,
          categoryCount: getServiceCategories(w.projectCode).length,
          locations: [],
        };
        byProject.set(w.projectId, g);
      }
      g.locations.push(w);
    }
    return [...byProject.values()];
  }, [persona]);

  const totalLocations = groups.reduce((sum, g) => sum + g.locations.length, 0);

  return (
    <div>
      <PageHeader
        title="Master Project & Location"
        description="Hirarki Project → Location (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Projects" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${groups.length} project · ${totalLocations} site`} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Building2 className="h-3 w-3" />
            {groups.length} project
          </Badge>
          <Badge variant="info" className="gap-1">
            <MapPin className="h-3 w-3" />
            {totalLocations} location
          </Badge>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Tidak ada project dalam cakupan Anda.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <Card key={g.projectId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {g.projectName}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {g.client}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {g.projectCode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Periode {g.invoicePeriod}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {g.locations.length} location
                    </span>
                    <span>{g.categoryCount} kategori layanan</span>
                  </div>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Location</th>
                          <th className="px-3 py-2 font-medium">Kode</th>
                          <th className="px-3 py-2 font-medium">Periode Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.locations.map((loc) => (
                          <tr key={loc.locationId} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{loc.locationName}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {loc.locationId}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{loc.invoicePeriod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
