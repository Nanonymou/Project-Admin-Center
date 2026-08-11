import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { listNotifications } from "@/db/repositories/notification-repository";
import { buildNotificationInbox } from "@/lib/server/services/notification-inbox-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/pusat-notifikasi?unreadOnly=1&limit=
 *
 * The calling persona's notification inbox, newest/most-urgent first. Prefers the
 * persisted notifications table (per recipient); falls back to the config-derived
 * unified inbox (reminders + deadlines) when empty, so the inbox always renders.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const unreadOnly = sp.get("unreadOnly") === "1" || sp.get("unreadOnly") === "true";
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  try {
    const rows = await listNotifications({ recipient: persona.id, unreadOnly, limit });
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      unread: rows.filter((r) => !r.read).length,
      notifications: rows.map((r) => ({
        id: r.id,
        source: r.source,
        level: r.level,
        title: r.title,
        detail: r.detail,
        href: r.href,
        projectCode: r.projectCode,
        locationId: r.locationId,
        read: r.read,
        at: r.createdAt,
      })),
    });
  } catch {
    let inbox = buildNotificationInbox(persona);
    if (unreadOnly) inbox = inbox.filter((n) => n.level !== "info");
    if (limit) inbox = inbox.slice(0, limit);
    return NextResponse.json({
      source: "config",
      count: inbox.length,
      unread: inbox.filter((n) => n.level !== "info").length,
      notifications: inbox.map((n) => ({ ...n, read: false, at: null })),
    });
  }
}
