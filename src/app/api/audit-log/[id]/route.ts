import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canViewAuditLog } from "@/lib/mock/access-config";
import { getAuditLogById } from "@/db/repositories/audit-log-repository";
import { buildSystemAuditLog } from "@/lib/mock/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit-log/[id] — a single audit log entry with its before/after
 * values. Restricted to Leader/Super Admin. Falls back to the config-derived
 * trail when the DB is unavailable so a linked entry still resolves; 404 when
 * the id is unknown in both.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!canViewAuditLog(persona.role)) {
    return NextResponse.json({ error: "Audit Log hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  try {
    const row = await getAuditLogById(id);
    if (!row) throw new Error("not-found");
    return NextResponse.json({
      source: "db",
      entry: {
        id: row.id,
        category: row.category,
        action: row.action,
        actor: row.actor,
        entityType: row.entityType,
        entityId: row.entityId,
        detail: row.detail,
        before: row.beforeValue,
        after: row.afterValue,
        projectId: row.projectId,
        locationId: row.locationId,
        at: row.createdAt,
      },
    });
  } catch {
    const e = buildSystemAuditLog().find((x) => x.id === id);
    if (!e) return NextResponse.json({ error: "Entri audit tidak ditemukan." }, { status: 404 });
    return NextResponse.json({
      source: "config",
      entry: {
        id: e.id,
        category: e.category,
        action: e.action,
        actor: e.actor,
        entityType: e.category,
        entityId: e.target,
        detail: e.detail,
        before: e.before,
        after: e.after,
        projectId: null,
        locationId: null,
        at: e.at,
      },
    });
  }
}
