import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { getSystemParameter } from "@/lib/mock/system-parameters";
import { listSystemParameterHistory } from "@/db/repositories/system-parameter-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/parameter-sistem/history?key=
 *
 * Change history for a single system parameter (or all parameters when `key` is
 * omitted), newest first. Reads the immutable system_parameter_history trail.
 * When the database is unavailable it returns an empty history rather than
 * erroring, so the page renders. Only Leader/Super Admin may view the trail.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat melihat riwayat." }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key")?.trim() || undefined;
  if (key && !getSystemParameter(key)) {
    return NextResponse.json({ error: "Parameter tidak dikenal." }, { status: 404 });
  }

  try {
    const rows = await listSystemParameterHistory(key);
    return NextResponse.json({
      source: "db",
      key: key ?? null,
      count: rows.length,
      history: rows.map((r) => ({
        id: r.id,
        key: r.key,
        label: getSystemParameter(r.key)?.label ?? r.key,
        before: r.beforeValue,
        after: r.afterValue,
        changedBy: r.changedBy,
        createdAt: r.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ source: "config", key: key ?? null, count: 0, history: [] });
  }
}
