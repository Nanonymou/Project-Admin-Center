"use client";

import { ArrowRight, Ban, Pencil, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PriceChangeAction, PriceChangeEntry } from "@/lib/mock/price-change-log";

const ACTION_META: Record<
  PriceChangeAction,
  { label: string; variant: "success" | "info" | "warning" | "danger"; Icon: typeof Plus }
> = {
  create: { label: "Dibuat", variant: "success", Icon: Plus },
  update: { label: "Diubah", variant: "info", Icon: Pencil },
  activate: { label: "Diaktifkan", variant: "warning", Icon: RotateCcw },
  deactivate: { label: "Dinonaktifkan", variant: "danger", Icon: Ban },
};

/**
 * Presentational price-change-history modal for the Harga Meals page. Renders a
 * site's Master Pricing change trail as a newest-first timeline. The parent owns
 * open/close state and passes the entries to show (empty array closes it),
 * along with an optional label describing the scope (a single category or the
 * whole site).
 */
export function PriceHistoryModal({
  open,
  onClose,
  entries,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  entries: PriceChangeEntry[];
  scopeLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Riwayat Perubahan Harga"
      description={scopeLabel}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{entries.length} kejadian</div>
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            Belum ada riwayat perubahan harga.
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((e) => {
              const meta = ACTION_META[e.action];
              const Icon = meta.Icon;
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <Badge variant={meta.variant} className="mt-0.5 shrink-0 gap-1">
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{e.categoryLabel}</span>
                      {e.action === "update" && (
                        <span className="flex items-center gap-1.5 text-xs tabular-nums">
                          <span className="text-muted-foreground line-through">
                            {e.before !== null ? formatCurrency(e.before) : "—"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {e.after !== null ? formatCurrency(e.after) : "—"}
                          </span>
                        </span>
                      )}
                      {e.action === "create" && e.after !== null && (
                        <span className="text-xs font-medium tabular-nums">{formatCurrency(e.after)}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.editor} · {formatDateTime(e.at)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Dialog>
  );
}
