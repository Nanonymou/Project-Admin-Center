"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { OutstandingFilterBar } from "@/components/outstanding/outstanding-filter-bar";
import { OutstandingInvoiceTable } from "@/components/outstanding/outstanding-invoice-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import { loadOutstandingFromDb } from "@/lib/client/invoices";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildOutstandingInvoicesFor, type OutstandingInvoice } from "@/lib/mock/outstanding";
import { cn } from "@/lib/utils";

export function OutstandingClient() {
  const { persona } = usePersona();
  const { filters, setFilters } = useGlobalFilters();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => scopedSites.some((s) => s.projectCode === p.code)),
    [scopedSites],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => scopedSites.some((s) => s.locationId === l.id)),
    [scopedSites],
  );

  useEffect(() => {
    const validProjects = new Set(personaProjectOptions.map((p) => p.code));
    const validLocations = new Set(personaLocationOptions.map((l) => l.id));
    const nextProjects = filters.projects.filter((p) => validProjects.has(p));
    const nextLocations = filters.locations.filter((l) => validLocations.has(l));
    if (
      nextProjects.length !== filters.projects.length ||
      nextLocations.length !== filters.locations.length
    ) {
      setFilters({ ...filters, projects: nextProjects, locations: nextLocations });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProjectOptions, personaLocationOptions]);

  const selectedLocationIds = useMemo(() => new Set(filters.locations), [filters.locations]);

  const filteredSites = useMemo(() => {
    return scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
  }, [scopedSites, filters.projects, filters.locations, selectedLocationIds]);

  // Live outstanding invoices from the DB (all accessible sites), else config.
  const [dbOutstanding, setDbOutstanding] = useState<OutstandingInvoice[] | null>(null);
  const live = dbOutstanding !== null;

  useEffect(() => {
    let cancelled = false;
    void loadOutstandingFromDb(personaHeaders(persona.id)).then((rows) => {
      if (!cancelled) setDbOutstanding(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [persona.id]);

  const allowedLocationIds = useMemo(
    () => new Set(filteredSites.map((s) => s.locationId)),
    [filteredSites],
  );

  const outstanding = useMemo(() => {
    if (dbOutstanding) return dbOutstanding.filter((o) => allowedLocationIds.has(o.locationId));
    return buildOutstandingInvoicesFor(filteredSites, SITE_DETAILS);
  }, [dbOutstanding, allowedLocationIds, filteredSites]);

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Outstanding Invoice Seluruh Site"
        description="Daftar lengkap invoice yang belum settled — filter aging, project, pencarian nomor, dan drill ke detail."
        breadcrumbs={[{ label: "Operasional" }, { label: "Outstanding Invoice" }]}
        actions={
          <>
            <ActivePeriodBadge />
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={!canExport}
              className={cn(!canExport && "cursor-not-allowed opacity-60")}
              title={canExport ? undefined : "Peran Anda tidak memiliki izin export"}
            >
              {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Export
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Filter global aktif — pilihan project & location sinkron dengan halaman lain.
            Outstanding = invoice yang belum masuk stage Payment atau berstatus overdue.
          </span>
        </div>

        {live && (
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Daftar outstanding diambil langsung dari database.
          </div>
        )}

        <OutstandingFilterBar
          locations={personaLocationOptions}
          matchedCount={outstanding.length}
        />

        <Card>
          <CardHeader>
            <CardTitle>Daftar Invoice Outstanding</CardTitle>
            <CardDescription>
              Total invoice belum lunas dari {filteredSites.length} site aktif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OutstandingInvoiceTable items={outstanding} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
