"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Bell, CalendarClock, CheckCheck, Filter, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
import { emitNotifChanged, personaHeaders } from "@/lib/client/notif";

type NotifSource = "reminder" | "deadline" | "system";
type NotifLevel = "info" | "warning" | "danger";

type Notif = {
  id: string;
  source: NotifSource;
  level: NotifLevel;
  title: string;
  detail: string;
  href: string | null;
  projectCode: string | null;
  locationId: string | null;
  read: boolean;
  at: string | null;
};

const SOURCE_META: Record<NotifSource, { label: string; icon: typeof Bell }> = {
  reminder: { label: "Reminder", icon: Bell },
  deadline: { label: "Deadline", icon: CalendarClock },
  system: { label: "Sistem", icon: Inbox },
};

const LEVEL_BADGE: Record<NotifLevel, "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  danger: "danger",
};

/**
 * Pusat Notifikasi & Reminder — the persona's DB-backed inbox. Lists reminders,
 * deadlines and system notices, supports marking one/all read (persisted), and
 * keeps the topbar badge in sync.
 */
export function PusatNotifikasiClient() {
  const { persona } = usePersona();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | NotifSource>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pusat-notifikasi", { cache: "no-store", headers: personaHeaders(persona.id) });
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [persona.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = useMemo(() => {
    return items.filter((n) => {
      if (sourceFilter !== "all" && n.source !== sourceFilter) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });
  }, [items, sourceFilter, unreadOnly]);

  const markRead = useCallback(
    async (id: string, read: boolean) => {
      // Optimistic update.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
      try {
        await fetch(`/api/pusat-notifikasi/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
          body: JSON.stringify({ read }),
        });
        emitNotifChanged();
      } catch {
        void load(); // reconcile on failure
      }
    },
    [persona.id, load],
  );

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/pusat-notifikasi/mark-all-read", { method: "POST", headers: personaHeaders(persona.id) });
      emitNotifChanged();
    } catch {
      void load();
    } finally {
      setBusy(false);
    }
  }, [persona.id, unreadCount, load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Pusat Notifikasi & Reminder"
        description="Reminder, deadline, dan pemberitahuan sistem dalam cakupan Anda."
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy || unreadCount === 0} className="gap-1.5">
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </Button>
        }
      />
      <PersonaBanner persona={persona} scopeSummary={`${unreadCount} belum dibaca`} />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["all", "reminder", "deadline", "system"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSourceFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              sourceFilter === s ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent",
            )}
          >
            {s === "all" ? "Semua" : SOURCE_META[s].label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-3.5 w-3.5" />
          Belum dibaca saja
        </label>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat notifikasi…
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Tidak ada notifikasi.</p>
            <p className="text-xs text-muted-foreground">Semua sudah ditangani. 🎉</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const meta = SOURCE_META[n.source] ?? SOURCE_META.system;
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    n.read ? "bg-background" : "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.read ? "bg-muted" : "bg-primary/10")}>
                    <Icon className={cn("h-4 w-4", n.read ? "text-muted-foreground" : "text-primary")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</p>
                      <Badge variant={LEVEL_BADGE[n.level] ?? "muted"} className="shrink-0">
                        {meta.label}
                      </Badge>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="belum dibaca" />}
                    </div>
                    {n.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.detail}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {n.locationId && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {n.locationId}
                          {n.projectCode ? ` · ${n.projectCode}` : ""}
                        </span>
                      )}
                      {n.href && (
                        <Link href={n.href} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                          Buka <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => markRead(n.id, !n.read)}
                    className="shrink-0 rounded-md border px-2 py-1 text-[11px] hover:bg-accent"
                  >
                    {n.read ? "Tandai belum" : "Tandai dibaca"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
