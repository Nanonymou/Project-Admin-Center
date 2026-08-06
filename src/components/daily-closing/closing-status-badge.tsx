"use client";

import { CheckCircle2, FileText, Eye, Lock, Send, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CLOSING_STATE_META, type ClosingState } from "@/lib/mock/closing-status";

const STATE_ICON: Record<ClosingState, LucideIcon> = {
  draft: FileText,
  submitted: Send,
  reviewed: Eye,
  approved: CheckCircle2,
  locked: Lock,
};

/**
 * Badge for a Daily Closing state — label, colour and icon all come from the
 * shared closing-state config, so every page shows the workflow identically.
 */
export function ClosingStatusBadge({
  state,
  showStep = false,
}: {
  state: ClosingState;
  showStep?: boolean;
}) {
  const meta = CLOSING_STATE_META[state];
  const Icon = STATE_ICON[state];
  return (
    <Badge variant={meta.variant} className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {showStep && <span className="opacity-70">{meta.step}.</span>}
      {meta.label}
    </Badge>
  );
}
