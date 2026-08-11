import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { listFormulaParameterHistory } from "@/db/repositories/formula-parameter-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/formula-engine/history?projectId=&key=&limit=
 *
 * The non-destructive audit trail of Formula Engine parameter changes for a
 * project (optionally one parameter), newest first. Returns an empty trail when
 * the DB is unavailable so the page still renders. Requires access to the
 * project; only Leader/Super Admin may view the trail.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? "";
  const key = sp.get("key")?.trim() || undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  if (!projectId) return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Riwayat parameter hanya untuk Leader/Super Admin." }, { status: 403 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    const rows = await listFormulaParameterHistory(projectId, key);
    const history = (limit ? rows.slice(0, limit) : rows).map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      action: r.action,
      before: r.beforeValue,
      after: r.afterValue,
      changedBy: r.changedBy,
      at: r.createdAt,
    }));
    return NextResponse.json({ source: "db", projectId, key: key ?? null, count: history.length, history });
  } catch {
    return NextResponse.json({ source: "config", projectId, key: key ?? null, count: 0, history: [] });
  }
}
