"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoRefreshState } from "@/lib/hooks/use-auto-refresh";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { label: "10s", ms: 10000 },
  { label: "30s", ms: 30000 },
  { label: "1m", ms: 60000 },
];

export function AutoRefreshControl({
  state,
  className,
}: {
  state: AutoRefreshState;
  className?: string;
}) {
  const { isAuto, setAuto, intervalMs, setIntervalMs, secondsToNext, lastUpdated, refreshNow } =
    state;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button variant="outline" size="sm" onClick={refreshNow}>
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>

      <div className="inline-flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={isAuto}
            onChange={(e) => setAuto(e.target.checked)}
            className="h-3 w-3 accent-primary"
          />
          <span className="font-medium">Auto</span>
        </label>
        <span className="inline-flex overflow-hidden rounded border">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              type="button"
              onClick={() => setIntervalMs(opt.ms)}
              disabled={!isAuto}
              className={cn(
                "px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                intervalMs === opt.ms
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
                !isAuto && "opacity-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </span>
        {isAuto ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {secondsToNext}s
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
