"use client";

import { Bell, Search, ChevronsUpDown } from "lucide-react";
import { MOCK_WORKSPACES, CURRENT_USER } from "@/lib/mock/workspaces";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const activeWorkspace = MOCK_WORKSPACES[0];
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
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
        <div className="flex items-center gap-2 border-l pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {CURRENT_USER.initials}
          </div>
          <div className="hidden leading-tight md:block">
            <div className="text-sm font-medium">{CURRENT_USER.name}</div>
            <div className="text-[11px] text-muted-foreground">{CURRENT_USER.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
