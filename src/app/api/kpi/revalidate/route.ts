import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/kpi/revalidate
 * Invalidates the KPI cache so the next read recomputes — the server-side hook
 * behind "auto-refresh KPI saat data berubah". Any KPI-changing mutation (a new
 * daily transaction, a closing status change, an invoice update) calls this so
 * clients see fresh figures without polling. Requires an authenticated persona;
 * read-only viewers may not trigger a refresh.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (auth.persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat memicu refresh KPI." }, { status: 403 });
  }

  revalidateKpi();
  return NextResponse.json({ ok: true, revalidatedAt: new Date().toISOString() });
}
