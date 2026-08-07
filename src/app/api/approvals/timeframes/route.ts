import { NextResponse, type NextRequest } from "next/server";
import { listMasterTimeframes } from "@/db/repositories/master-timeframe-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/timeframes?projectId=&subjectType=invoice|daily_closing
 * The approval stage SLAs (timeframes) for a project — the reference data the
 * approval-monitoring timeline uses to flag at-risk / breached stages. Requires
 * an authenticated persona with access to the project. Falls back to the
 * config-derived timeframes when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const subjectTypeRaw = sp.get("subjectType");
  const subjectType =
    subjectTypeRaw === "invoice" || subjectTypeRaw === "daily_closing" ? subjectTypeRaw : undefined;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!projectId) return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    const rows = await listMasterTimeframes({ projectCode: projectId, subjectType, activeOnly: true });
    if (rows.length === 0) throw new Error("no timeframes seeded");
    const timeframes = rows.map((r) => ({
      subjectType: r.subjectType,
      stage: r.stage,
      slaDays: r.slaDays,
      order: r.orderIndex,
    }));
    return NextResponse.json({ source: "db", projectId, subjectType, timeframes });
  } catch {
    const types: ("invoice" | "daily_closing")[] = subjectType ? [subjectType] : ["invoice", "daily_closing"];
    const timeframes = types.flatMap((t) =>
      getApprovalTimeframes(projectId, t).map((tf) => ({
        subjectType: t,
        stage: tf.stage,
        slaDays: tf.slaDays,
        order: tf.order,
      })),
    );
    return NextResponse.json({ source: "mock", projectId, subjectType, timeframes });
  }
}
