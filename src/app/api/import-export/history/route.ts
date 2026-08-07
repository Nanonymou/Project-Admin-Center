import { NextResponse, type NextRequest } from "next/server";
import {
  listImportExportJobs,
  type JobFilter,
} from "@/db/repositories/import-export-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/import-export/history?direction=import|export&entity=&projectId=&limit=
 *
 * Lists the import/export job history for the Leader Admin's monitoring view.
 * Restricted to leader/super admins — site admins see only their own module
 * screens, not the cross-project transfer log. Returns an empty list when the
 * database is unavailable so the history panel degrades gracefully.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const canViewHistory = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!canViewHistory) {
    return NextResponse.json(
      { error: "Riwayat impor/ekspor hanya untuk Leader Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const directionParam = sp.get("direction");
  const direction =
    directionParam === "import" || directionParam === "export" ? directionParam : undefined;
  const projectId = sp.get("projectId") ?? undefined;
  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const limitParam = Number(sp.get("limit"));
  const filter: JobFilter = {
    direction,
    entity: sp.get("entity") ?? undefined,
    projectId,
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
  };

  try {
    const jobs = await listImportExportJobs(filter);
    // Defense in depth: a leader may be scoped to a subset of projects. Hide
    // rows for projects outside their scope (project-less rows stay visible).
    const visible = jobs.filter((j) => !j.projectId || canAccessProject(persona, j.projectId));
    return NextResponse.json({ source: "db", count: visible.length, jobs: visible });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, jobs: [] });
  }
}
