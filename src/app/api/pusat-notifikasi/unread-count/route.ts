import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { listNotifications } from "@/db/repositories/notification-repository";
import { buildNotificationInbox } from "@/lib/server/services/notification-inbox-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/pusat-notifikasi/unread-count — the calling persona's unread
 * notification count, for the sidebar/topbar badge. Prefers the persisted unread
 * rows; falls back to the config-derived inbox's non-info (critical/warning)
 * count when there is no DB, matching the client's badge logic.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    // A successful query (even zero unread) is authoritative; only a DB error
    // falls through to the config-derived count.
    const unread = (await listNotifications({ recipient: persona.id, unreadOnly: true })).filter(
      (r) => !r.projectCode || canAccessLocation(persona, r.locationId ?? "", r.projectCode),
    );
    return NextResponse.json({ source: "db", unread: unread.length });
  } catch {
    const count = buildNotificationInbox(persona).filter((n) => n.level !== "info").length;
    return NextResponse.json({ source: "config", unread: count });
  }
}
