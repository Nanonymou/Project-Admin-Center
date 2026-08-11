import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canViewAuditLog } from "@/lib/mock/access-config";
import { listAuditLogs } from "@/db/repositories/audit-log-repository";
import { buildSystemAuditLog } from "@/lib/mock/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit-log?category=&actor=&from=&to=&q=&limit=
 *
 * The system/security audit trail for the Audit Log page, newest first, with
 * before/after values included. Restricted to Leader/Super Admin (the trail spans
 * privileged configuration & security events). Falls back to the config-derived
 * trail (`buildSystemAuditLog`) when the DB is unavailable. Filters: category,
 * actor, date range, and free-text `q`.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!canViewAuditLog(persona.role)) {
    return NextResponse.json({ error: "Audit Log hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? undefined;
  const actor = (sp.get("actor") ?? "").trim();
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  try {
    // Executive scope: an admin sees system-wide entries.
    let rows = await listAuditLogs({ scope: "executive", category, from, to, limit });
    if (rows.length === 0) throw new Error("empty");
    if (actor) rows = rows.filter((r) => (r.actor ?? "").toLowerCase().includes(actor.toLowerCase()));
    if (q) {
      rows = rows.filter((r) =>
        `${r.actor ?? ""} ${r.detail ?? ""} ${r.action} ${r.entityId ?? ""}`.toLowerCase().includes(q),
      );
    }
    return NextResponse.json({
      source: "db",
      count: rows.length,
      logs: rows.map((r) => ({
        id: r.id,
        category: r.category,
        action: r.action,
        actor: r.actor,
        entityType: r.entityType,
        entityId: r.entityId,
        detail: r.detail,
        before: r.beforeValue,
        after: r.afterValue,
        at: r.createdAt,
      })),
    });
  } catch {
    let entries = buildSystemAuditLog();
    if (category) entries = entries.filter((e) => e.category === category);
    if (actor) entries = entries.filter((e) => e.actor.toLowerCase().includes(actor.toLowerCase()));
    if (q) entries = entries.filter((e) => `${e.actor} ${e.detail} ${e.action} ${e.target}`.toLowerCase().includes(q));
    if (limit) entries = entries.slice(0, limit);
    return NextResponse.json({
      source: "config",
      count: entries.length,
      logs: entries.map((e) => ({
        id: e.id,
        category: e.category,
        action: e.action,
        actor: e.actor,
        entityType: e.category,
        entityId: e.target,
        detail: e.detail,
        before: e.before,
        after: e.after,
        at: e.at,
      })),
    });
  }
}
