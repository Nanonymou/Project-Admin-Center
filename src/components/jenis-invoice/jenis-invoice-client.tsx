"use client";

import { FileText, Fuel, Percent, Minus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { listInvoiceTypes } from "@/lib/mock/invoice-type-config";

/** Render a fraction (0..1) as a percentage string, e.g. 0.06 → "6%". */
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction * 100 % 1 === 0 ? 0 : 1)}%`;
}

/**
 * Jenis Invoice — the config-driven catalogue of invoice type profiles
 * (`invoice-type-config.ts`). Each profile shapes how an invoice's financial
 * inputs are derived: the default deduction rate and whether a BBM (fuel)
 * surcharge participates. Type profiles are generic (no project-named entries),
 * so they stay reusable across every project. Read-only master reference.
 */
export function JenisInvoiceClient() {
  const { persona } = usePersona();
  const types = listInvoiceTypes();

  return (
    <div>
      <PageHeader
        title="Jenis Invoice"
        description="Profil jenis invoice (config-driven) yang membentuk perhitungan finansial."
        breadcrumbs={[{ label: "Master Data" }, { label: "Jenis Invoice" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${types.length} jenis`} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Daftar Jenis Invoice
            </CardTitle>
            <CardDescription>
              Profil ini menentukan potongan default dan surcharge BBM. Tarif pajak/penalty aktual tetap
              mengikuti konfigurasi per-project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Jenis Invoice</th>
                    <th className="px-3 py-2 font-medium">Kode</th>
                    <th className="px-3 py-2 text-right font-medium">Potongan Default</th>
                    <th className="px-3 py-2 font-medium">BBM Surcharge</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.key} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">{t.label}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.key}</td>
                      <td className="px-3 py-2 text-right">
                        {t.deductionRate > 0 ? (
                          <Badge variant="warning" className="gap-1">
                            <Minus className="h-3 w-3" />
                            {pct(t.deductionRate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.hasBbm ? (
                          <Badge variant="info" className="gap-1">
                            <Fuel className="h-3 w-3" />
                            {pct(t.bbmRate)}
                          </Badge>
                        ) : (
                          <Badge variant="muted">Tidak</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {types.map((t) => (
            <Card key={t.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t.label}</CardTitle>
                <CardDescription className="font-mono text-xs">{t.key}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Percent className="h-3.5 w-3.5" />
                    Potongan
                  </span>
                  <span className="font-medium tabular-nums">{pct(t.deductionRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Fuel className="h-3.5 w-3.5" />
                    BBM
                  </span>
                  <span className="font-medium tabular-nums">
                    {t.hasBbm ? pct(t.bbmRate) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
