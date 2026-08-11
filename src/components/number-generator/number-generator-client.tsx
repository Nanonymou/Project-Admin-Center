"use client";

import { Hash, Repeat, Braces } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listNumberFormats,
  generateSample,
  tokensInPattern,
  RESET_PERIOD_LABEL,
} from "@/lib/mock/number-format";

/**
 * Automatic Number Generator — the config-driven registry of per-document
 * numbering formats (PRD §Automatic Number Generator). Each format renders a
 * document number from a token pattern ({PREFIX}/{YYYY}/{MM}/{SEQ}), with a live
 * sample of the next number. Read-only overview; add/edit and history/deactivate
 * are layered on by later tasks. Persona-scoped.
 */
export function NumberGeneratorClient() {
  const { persona } = usePersona();
  const formats = listNumberFormats();

  return (
    <div>
      <PageHeader
        title="Penomoran Dokumen"
        description="Konfigurasi format nomor otomatis per dokumen (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Penomoran Dokumen" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${formats.length} format`} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Daftar Format Nomor
            </CardTitle>
            <CardDescription>
              Token: {"{PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}"} — nomor dihasilkan otomatis saat dokumen dibuat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Dokumen</th>
                    <th className="px-3 py-2 font-medium">Pola</th>
                    <th className="px-3 py-2 font-medium">Reset</th>
                    <th className="px-3 py-2 text-right font-medium">Urut Berikut</th>
                    <th className="px-3 py-2 font-medium">Contoh</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {formats.map((f) => (
                    <tr key={f.key} className={`border-b last:border-b-0 ${f.active ? "" : "opacity-50"}`}>
                      <td className="px-3 py-2 font-medium">
                        {f.label}
                        <div className="font-mono text-[11px] text-muted-foreground">{f.prefix}</div>
                      </td>
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{f.pattern}</code>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tokensInPattern(f.pattern).map((t) => (
                            <span key={t} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Braces className="h-2.5 w-2.5" />
                              {t.replace(/[{}]/g, "")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="muted" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {RESET_PERIOD_LABEL[f.resetPeriod]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.nextSeq}</td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-xs font-semibold text-primary">
                          {generateSample(f)}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={f.active ? "success" : "muted"}>{f.active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
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
