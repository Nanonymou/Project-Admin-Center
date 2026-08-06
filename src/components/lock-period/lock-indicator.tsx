"use client";

import { Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeriodLockRow } from "@/lib/mock/lock-period";

/**
 * Visual indicator for a period's lock state. Locked periods also surface
 * who locked them and when, so the frozen status is unambiguous.
 */
export function LockIndicator({ row, className }: { row: PeriodLockRow; className?: string }) {
  const locked = row.state === "locked";
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <Badge variant={locked ? "success" : "warning"} className="inline-flex items-center gap-1">
        {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
        {locked ? "Terkunci" : "Terbuka"}
      </Badge>
      {locked && row.lockedBy && (
        <span className="text-[10px] text-muted-foreground">
          {row.lockedBy} · {row.lockedAt}
        </span>
      )}
    </span>
  );
}
