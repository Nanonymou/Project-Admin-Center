import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { getNotificationById, setNotificationRead } from "@/db/repositories/notification-repository";
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
    // Per-site access: a site-scoped notification requires access to that site.
    if (row.projectCode && !canAccessLocation(persona, row.locationId ?? "", row.projectCode)) {
      return NextResponse.json({ error: "Tidak ada akses ke lokasi notifikasi ini." }, { status: 403 });
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

/**
 * PATCH /api/pusat-notifikasi/[id] — mark a notification read/unread.
 * Body: { read }. Only the recipient may change their own notification. When the
 * notification is config-derived (no DB row), the change is a no-op success since
 * read-state is not persisted — the client tracks it locally.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  const read = body.read === undefined ? true : Boolean(body.read);

  try {
    const row = await getNotificationById(id);
    if (row) {
      if (row.recipient !== persona.id) {
        return NextResponse.json({ error: "Tidak ada akses ke notifikasi ini." }, { status: 403 });
      }
      await setNotificationRead(id, read);
      return NextResponse.json({ ok: true, id, read });
    }
    // No DB row — config-derived notification, read-state is client-side only.
    return NextResponse.json({ ok: true, id, read, persisted: false });
  } catch {
    return NextResponse.json({ ok: true, id, read, persisted: false });
  }
}
