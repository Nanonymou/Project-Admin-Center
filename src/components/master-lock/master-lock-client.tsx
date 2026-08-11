"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, LockOpen, GitCommitVertical, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { formatDate } from "@/lib/utils";
import { listMasterEntities, LOCK_CATEGORIES } from "@/lib/mock/master-lock";

/**
 * Master Lock & Version Management — the central registry of lockable master-data
 * domains (PRD §Master Lock & Version Management). Each domain shows its lock
 * state and current version; changes are versioned non-destructively. Read-only
 * overview here; lock/unlock control, version history, and read-only enforcement
 * are layered on by later tasks. Persona-scoped.
 */
export function MasterLockClient() {
  const { persona } = usePersona();
  const entities = listMasterEntities();

  const byCategory = useMemo(
    () =>
      LOCK_CATEGORIES.map((category) => ({
        category,
        items: entities.filter((e) => e.category === category),
      })).filter((g) => g.items.length > 0),
    [entities],
  );

  const lockedCount = entities.filter((e) => e.locked).length;

  return (
    <div>
      <PageHeader
        title="Master Lock & Versi"
        description="Kunci integritas Master Data dan telusuri histori versinya."
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Lock & Versi" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${entities.length} master`} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {entities.length} domain master
          </Badge>
          <Badge variant="danger" className="gap-1">
            <Lock className="h-3 w-3" />
            {lockedCount} terkunci
          </Badge>
          <Badge variant="success" className="gap-1">
            <LockOpen className="h-3 w-3" />
            {entities.length - lockedCount} terbuka
          </Badge>
        </div>

        {byCategory.map(({ category, items }) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{category}</CardTitle>
              <CardDescription>{items.length} domain master</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Master Data</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Versi</th>
                      <th className="px-3 py-2 font-medium">Diubah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.key} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            {e.label}
                            {e.href && (
                              <Link
                                href={e.href}
                                className="text-muted-foreground hover:text-primary"
                                aria-label={`Buka ${e.label}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {e.locked ? (
                            <Badge variant="danger" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Terkunci
                            </Badge>
                          ) : (
                            <Badge variant="success" className="gap-1">
                              <LockOpen className="h-3 w-3" />
                              Terbuka
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="gap-1">
                            <GitCommitVertical className="h-3 w-3" />v{e.version}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {e.lastModifiedBy} · {formatDate(e.lastModifiedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
