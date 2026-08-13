"use client";

import { Lock } from "lucide-react";

/**
 * Read-only notice for a master-data page. Renders nothing when there is no
 * reason (i.e. the form is editable); otherwise shows why the page is read-only
 * (locked, or insufficient role) — paired with `useMasterEditable`.
 */
export function LockBanner({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <span>{reason}</span>
    </div>
  );
}
