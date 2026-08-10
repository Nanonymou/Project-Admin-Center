import { NextResponse, type NextRequest } from "next/server";
import { resolveWorkflow } from "@/lib/server/services/master-timeframe-service";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow-approval?project=<code>&subject=invoice|daily_closing
 * The default approval workflow for a project + document type — the ordered
 * stages with SLA, responsible role, stage type, and document requirement, as
 * shown on the Workflow Default Approval page. Master Timeframe rows override the
 * config-driven defaults per stage. Persona-scoped: the persona must have access
 * to the requested project.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const project = sp.get("project") ?? sp.get("projectId") ?? "";
  const subject = sp.get("subject") === "daily_closing" ? "daily_closing" : "invoice";
  if (!project) {
    return NextResponse.json({ error: "project wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, project)) {
    return NextResponse.json(
      { error: `Tidak ada akses ke project ${project}.`, role: persona.role },
      { status: 403 },
    );
  }

  const stages = await resolveWorkflow(project, subject);
  const totalSla = stages.reduce((s, f) => s + f.slaDays, 0);
  return NextResponse.json({
    project,
    subject,
    count: stages.length,
    totalSla,
    stages,
  });
}
