import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { getActivityLogById } from "@/db/repositories/activity-log-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity-log/[id] — a single activity log entry. Authorized: the row's
 * site must be within the persona's scope (an org-wide row with no project is
 * visible to any authenticated persona). Returns 404 when not found (or when the
 * DB is unavailable, since there is no config fallback for a specific row).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  try {
    const row = await getActivityLogById(id);
    if (!row) return NextResponse.json({ error: "Aktivitas tidak ditemukan." }, { status: 404 });

    // Scope check: an entry tied to a project/location must be inside scope.
    if (row.projectCode && !canAccessLocation(persona, row.locationId ?? "", row.projectCode)) {
      return NextResponse.json({ error: "Tidak ada akses ke aktivitas ini." }, { status: 403 });
    }

    return NextResponse.json({
      activity: {
        id: row.id,
        action: row.action,
        actor: row.actor,
        role: row.role,
        target: row.target,
        projectCode: row.projectCode,
        locationId: row.locationId,
        detail: row.detail,
        at: row.createdAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Aktivitas tidak tersedia (database tidak tersedia)." }, { status: 404 });
  }
}
