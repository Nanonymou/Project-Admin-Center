import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { markAllRead } from "@/db/repositories/notification-repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/pusat-notifikasi/mark-all-read — mark all of the calling persona's
 * notifications as read. Returns the number updated. When there is no DB
 * (config-derived inbox) this resolves with updated: 0 since read-state is not
 * persisted; the client clears its local unread state.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const updated = await markAllRead(persona.id);
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ ok: true, updated: 0, persisted: false });
  }
}
