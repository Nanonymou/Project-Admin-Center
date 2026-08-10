"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { SalesTransaction } from "@/lib/mock/sales-change-log";

/**
 * Reusable change-history modal. Renders a transaction's create/update trail as
 * a timeline; the parent owns open/close state and passes the transaction (or
 * null when closed). Kept presentational so it can be reused by any list that
 * carries a `SalesTransaction`-shaped history.
 */
export function ChangeHistoryModal({
  transaction,
  onClose,
}: {
  transaction: SalesTransaction | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={transaction !== null}
      onClose={onClose}
      title="Riwayat Perubahan Transaksi"
      description={
        transaction
          ? `${transaction.categoryLabel} · ${transaction.locationName} · ${formatDate(transaction.trxDate)}`
          : undefined
      }
      className="max-w-lg"
    >
      {transaction && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{transaction.history.length} kejadian</span>
            {transaction.editedCount > 0 && (
              <Badge variant="info">{transaction.editedCount} perubahan</Badge>
            )}
          </div>
          <ol className="space-y-3">
            {transaction.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3">
                <Badge variant={h.action === "create" ? "success" : "info"} className="mt-0.5 shrink-0">
                  {h.action === "create" ? "Dibuat" : "Diubah"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium capitalize">{h.field}</span>
                    {h.action === "update" && (
                      <span className="flex items-center gap-1.5 text-xs tabular-nums">
                        <span className="text-muted-foreground line-through">{h.before}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{h.after}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {h.editor} · {formatDateTime(h.at)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Dialog>
  );
}
