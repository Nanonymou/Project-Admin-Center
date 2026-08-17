"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { filterNavForRole } from "@/lib/mock/access-config";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
import { LayoutDashboard } from "lucide-react";
import { onNotifChanged, personaHeaders } from "@/lib/client/notif";

/** Nav hrefs that show the live unread-notification count badge. */
const NOTIFICATION_HREFS = new Set(["/pusat-notifikasi", "/notification-center"]);

export function Sidebar() {
  const pathname = usePathname();
  const { persona } = usePersona();
  const sections = filterNavForRole(persona.role);

  // Live unread count from the DB inbox — the same source as the topbar bell,
  // refreshed whenever a notification is marked read.
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/pusat-notifikasi/unread-count", {
          cache: "no-store",
          headers: personaHeaders(persona.id),
        });
        const data = await res.json();
        if (!cancelled) setUnreadCount(Number(data?.unread ?? 0));
      } catch {
        /* keep last value */
      }
    }
    void refresh();
    const off = onNotifChanged(refresh);
    return () => {
      cancelled = true;
      off();
    };
  }, [persona.id]);
  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Project Admin</div>
          <div className="text-[11px] text-sidebar-foreground/60">Enterprise Center</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-white"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {NOTIFICATION_HREFS.has(item.href) && unreadCount > 0 ? (
                        <span
                          className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          aria-label={`${unreadCount} belum dibaca`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : (
                        item.badge && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {item.badge}
                          </span>
                        )
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-[11px] text-sidebar-foreground/50">
        v0.1.0 · Fase 1 Frontend
      </div>
    </aside>
  );
}
