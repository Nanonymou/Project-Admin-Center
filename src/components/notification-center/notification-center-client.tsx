"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Filter, MapPin, ChevronRight, Loader2, Inbox } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { cn } from "@/lib/utils";
import { emitNotifChanged, personaHeaders } from "@/lib/client/notif";

type NotifLevel = "info" | "warning" | "danger";

type Notif = {
  id: string;
  source: string;
  level: NotifLevel;
  title: string;
  detail: string;
  href: string | null;
  projectCode: string | null;
  locationId: string | null;
  read: boolean;
  at: string | null;
};

const LEVEL_GROUPS: { level: NotifLevel; label: string; badge: "danger" | "warning" | "info" }[] = [
  { level: "danger", label: "Kritis", badge: "danger" },
  { level: "warning", label: "Peringatan", badge: "warning" },
  { level: "info", label: "Informasi", badge: "info" },
];

/**
 * Notification Center — the persona's DB-backed notifications grouped by
 * severity, with persisted mark-as-read that keeps the topbar badge in sync.
 */
export function NotificationCenterClient() {
  const { persona } = usePersona();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | NotifLevel>("all");

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

  const markRead = useCallback(
    async (id: string, read: boolean) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
      try {
        await fetch(`/api/pusat-notifikasi/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
          body: JSON.stringify({ read }),
        });
        emitNotifChanged();
      } catch {
        void load();
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

  const groups = useMemo(
    () =>
      LEVEL_GROUPS.map((g) => ({
        ...g,
        items: items.filter((n) => n.level === g.level && (levelFilter === "all" || levelFilter === g.level)),
      })).filter((g) => g.items.length > 0),
    [items, levelFilter],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Notification Center"
        description="Pemberitahuan dalam cakupan Anda, dikelompokkan menurut tingkat kepentingan."
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
        {(["all", "danger", "warning", "info"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevelFilter(l)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              levelFilter === l ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent",
            )}
          >
            {l === "all" ? "Semua" : l === "danger" ? "Kritis" : l === "warning" ? "Peringatan" : "Informasi"}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat notifikasi…
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Tidak ada notifikasi.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <Card key={g.level}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4" />
                  {g.label}
                  <Badge variant={g.badge}>{g.items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {g.items.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        n.read ? "bg-background" : "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</p>
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
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
