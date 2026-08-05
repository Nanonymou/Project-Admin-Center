"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronsUpDown, Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { persona, personas, setPersonaId } = usePersona();
  const { activeWorkspace, workspaces, activeLocationId, setActiveLocationId } = useActiveSite();
  const [open, setOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const siteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (siteRef.current && !siteRef.current.contains(e.target as Node)) setSiteOpen(false);
    }
    if (open || siteOpen) window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open, siteOpen]);

  const accessibleWorkspaces = workspaces.filter((w) =>
    canAccessLocation(persona, w.locationId, w.projectCode),
  );
  const canSwitch = persona.capabilities.canSwitchWorkspace && accessibleWorkspaces.length > 1;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
      <div className="relative" ref={siteRef}>
        <button
          type="button"
          onClick={() => canSwitch && setSiteOpen((s) => !s)}
          disabled={!canSwitch}
          aria-haspopup="menu"
          aria-expanded={siteOpen}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
            canSwitch ? "hover:bg-accent" : "cursor-not-allowed opacity-60",
          )}
          aria-label="Site switcher"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
            {activeWorkspace.projectCode.slice(0, 2)}
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs text-muted-foreground">Workspace</div>
            <div className="text-sm font-medium">
              {activeWorkspace.projectName} · {activeWorkspace.locationName}
            </div>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {siteOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 w-72 rounded-lg border bg-card p-2 shadow-lg"
          >
            <div className="mb-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pilih Workspace
            </div>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {accessibleWorkspaces.map((w) => {
                const active = w.locationId === activeLocationId;
                return (
                  <li key={w.locationId}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLocationId(w.locationId);
                        setSiteOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                        active && "bg-accent",
                      )}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                        {w.projectCode.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{w.locationName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {w.projectName} · {w.client}
                        </div>
                      </div>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="relative ml-2 hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Global search: invoice, transaksi, PIC…"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <div className="relative flex items-center gap-2 border-l pl-3" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {persona.initials}
            </div>
            <div className="hidden leading-tight text-left md:block">
              <div className="text-sm font-medium">{persona.name}</div>
              <div className="text-[11px] text-muted-foreground">{persona.roleLabel}</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border bg-card p-2 shadow-lg"
            >
              <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" />
                Simulasikan sebagai
              </div>
              <ul className="space-y-0.5">
                {personas.map((p) => {
                  const active = p.id === persona.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPersonaId(p.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                          active && "bg-accent",
                        )}
                      >
                        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {p.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{p.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{p.roleLabel}</div>
                        </div>
                        {active && <Check className="mt-1.5 h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 border-t px-2 pt-2 text-[11px] text-muted-foreground">
                Persona hanya simulasi UI — tidak menembus backend security.
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
