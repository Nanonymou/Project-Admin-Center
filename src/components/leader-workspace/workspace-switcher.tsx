"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, MapPin, Search } from "lucide-react";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

/**
 * Reusable workspace switcher for leaders. Drives the GLOBAL active site
 * (`useActiveSite`) so a switch persists across pages and stays in sync with the
 * topbar switcher. Persona-scoped: only workspaces the leader may access are
 * listed, grouped by project, with an in-menu search. Renders a read-only chip
 * when the persona cannot switch (e.g. a single-site admin).
 */
export function LeaderWorkspaceSwitcher({ className }: { className?: string }) {
  const { persona } = usePersona();
  const { activeLocationId, setActiveLocationId, workspaces } = useActiveSite();

  const scoped = useMemo(
    () => workspaces.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [workspaces, persona],
  );
  const active = scoped.find((w) => w.locationId === activeLocationId) ?? scoped[0];
  const canSwitch = persona.capabilities.canSwitchWorkspace && scoped.length > 1;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const grouped = useMemo(() => {
    const filtered = scoped.filter(
      (w) =>
        !q ||
        w.locationName.toLowerCase().includes(q) ||
        w.projectName.toLowerCase().includes(q) ||
        w.projectCode.toLowerCase().includes(q),
    );
    const map = new Map<string, typeof filtered>();
    for (const w of filtered) {
      const arr = map.get(w.projectName) ?? [];
      arr.push(w);
      map.set(w.projectName, arr);
    }
    return [...map];
  }, [scoped, q]);

  if (!active) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Tidak ada workspace.</span>;
  }

  if (!canSwitch) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm opacity-80",
          className,
        )}
      >
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {active.projectName} · {active.locationName}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
          {active.projectCode.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1 text-left leading-tight">
          <div className="text-[11px] text-muted-foreground">Workspace</div>
          <div className="truncate text-sm font-medium">
            {active.projectName} · {active.locationName}
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-2 w-80 max-w-[90vw] rounded-lg border bg-card p-2 shadow-lg"
        >
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari project atau site…"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {grouped.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Tidak ada workspace cocok.
              </div>
            )}
            {grouped.map(([projectName, sites]) => (
              <div key={projectName}>
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {projectName}
                </div>
                <ul className="space-y-0.5">
                  {sites.map((w) => {
                    const isActive = w.locationId === activeLocationId;
                    return (
                      <li key={w.locationId}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLocationId(w.locationId);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                            isActive && "bg-accent",
                          )}
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                            {w.projectCode.slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{w.locationName}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {w.projectCode} · {w.client}
                            </div>
                          </div>
                          {isActive && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
