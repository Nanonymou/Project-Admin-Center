import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { getNotificationById } from "@/db/repositories/notification-repository";
import { buildNotificationInbox } from "@/lib/server/services/notification-inbox-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/pusat-notifikasi/[id] — a single notification. Prefers the persisted
 * row (authorized to the calling recipient); falls back to the config-derived
 * inbox so a listed entry resolves even without persistence. 404 when unknown.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  try {
    const row = await getNotificationById(id);
    if (!row) throw new Error("not-found");
    if (row.recipient !== persona.id) {
      return NextResponse.json({ error: "Tidak ada akses ke notifikasi ini." }, { status: 403 });
    }
    return NextResponse.json({
      source: "db",
      notification: {
        id: row.id,
        source: row.source,
        level: row.level,
        title: row.title,
        detail: row.detail,
        href: row.href,
        projectCode: row.projectCode,
        locationId: row.locationId,
        read: row.read,
        at: row.createdAt,
      },
    });
  } catch {
    const n = buildNotificationInbox(persona).find((x) => x.id === id);
    if (!n) return NextResponse.json({ error: "Notifikasi tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ source: "config", notification: { ...n, read: false, at: null } });
  }
}
