"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronsUpDown, Search, UserCog, LogOut } from "lucide-react";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { TopbarFilter } from "@/components/app/topbar-filter";
import { canAccessLocation } from "@/lib/personas";
import { clearSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminders } from "@/lib/mock/reminders";
import { buildDeadlines } from "@/lib/mock/deadlines";

export function Topbar() {
  const router = useRouter();
  const { persona, personas, setPersonaId } = usePersona();
  const { activeWorkspace, workspaces, activeLocationId, setActiveLocationId } = useActiveSite();

  function logout() {
    clearSession();
    setOpen(false);
    router.push("/login");
  }
  const [open, setOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteQuery, setSiteQuery] = useState("");
  const [headerQuery, setHeaderQuery] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const siteRef = useRef<HTMLDivElement | null>(null);
  const siteSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (siteRef.current && !siteRef.current.contains(e.target as Node)) setSiteOpen(false);
    }
    if (open || siteOpen) window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open, siteOpen]);

  // Live unread-notification count (critical/warning reminders + overdue/
  // due-today deadlines) across the persona's accessible sites.
  const unreadCount = useMemo(() => {
    const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    const reminders = sites.flatMap((s) => buildReminders(s)).filter((r) => r.level !== "info").length;
    const deadlines = buildDeadlines(sites).filter((d) => d.status === "overdue" || d.status === "due_today").length;
    return reminders + deadlines;
  }, [persona]);

  const accessibleWorkspaces = workspaces.filter((w) =>
    canAccessLocation(persona, w.locationId, w.projectCode),
  );
  const canSwitch = persona.capabilities.canSwitchWorkspace && accessibleWorkspaces.length > 1;

  // Global shortcut (⌘/Ctrl+K) opens the workspace switcher and focuses search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (canSwitch) {
          setSiteQuery("");
          setSiteOpen(true);
        }
      } else if (e.key === "Escape") {
        setSiteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSwitch]);

  // Focus the search box whenever the switcher opens.
  useEffect(() => {
    if (siteOpen) siteSearchRef.current?.focus();
  }, [siteOpen]);

  // Filter accessible workspaces by the in-menu query, then group by project so
  // large multi-site orgs stay navigable.
  const q = siteQuery.trim().toLowerCase();
  const filteredWorkspaces = accessibleWorkspaces.filter(
    (w) =>
      !q ||
      w.locationName.toLowerCase().includes(q) ||
      w.projectName.toLowerCase().includes(q) ||
      w.projectCode.toLowerCase().includes(q) ||
      w.client.toLowerCase().includes(q),
  );
  const groupedWorkspaces = Array.from(
    filteredWorkspaces.reduce((map, w) => {
      const arr = map.get(w.projectName) ?? [];
      arr.push(w);
      map.set(w.projectName, arr);
      return map;
    }, new Map<string, typeof filteredWorkspaces>()),
  );

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
          {canSwitch && (
            <kbd className="ml-1 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
              ⌘K
            </kbd>
          )}
        </button>

        {siteOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 w-80 rounded-lg border bg-card p-2 shadow-lg"
          >
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={siteSearchRef}
                type="search"
                value={siteQuery}
                onChange={(e) => setSiteQuery(e.target.value)}
                placeholder="Cari project, site, atau client…"
                className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {groupedWorkspaces.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Tidak ada workspace cocok.
                </div>
              )}
              {groupedWorkspaces.map(([projectName, sites]) => (
                <div key={projectName}>
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {projectName}
                  </div>
                  <ul className="space-y-0.5">
                    {sites.map((w) => {
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
                                {w.projectCode} · {w.client}
                              </div>
                            </div>
                            {active && <Check className="h-4 w-4 text-primary" />}
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

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = headerQuery.trim();
          router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        }}
        className="relative ml-2 hidden max-w-md flex-1 md:block"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={headerQuery}
          onChange={(e) => setHeaderQuery(e.target.value)}
          placeholder="Global search: invoice, transaksi, PIC…"
          aria-label="Pencarian global"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      {/* Mobile: compact search icon that opens the global search page. */}
      <button
        type="button"
        onClick={() => router.push("/search")}
        aria-label="Pencarian global"
        className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      <TopbarFilter />

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/pusat-notifikasi"
          aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ""}`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
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
              <button
                type="button"
                onClick={logout}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-rose-600 hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
