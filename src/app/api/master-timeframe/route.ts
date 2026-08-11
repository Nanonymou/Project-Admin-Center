import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import {
  saveWorkflow,
  listWorkflowsForSite,
  setWorkflowActive,
  type WorkflowActivityInput,
} from "@/db/repositories/workflow-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { assertDomainUnlocked, autoVersionDomain } from "@/lib/server/services/master-lock-guard";
import { buildWorkflowsForSite, workflowTotalSla } from "@/lib/mock/workflow-config";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-timeframe?locationId=
 *
 * Lists the workflows (with activities) configured for a site. Falls back to the
 * config-derived default workflows when the database has no rows, so it always
 * responds. Requires access to the location.
 */
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  const ws = MOCK_WORKSPACES.find((w) => w.locationId === locationId);

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!locationId || !ws) {
    return NextResponse.json({ error: "locationId valid wajib diisi." }, { status: 400 });
  }
  if (!canAccessLocation(persona, locationId, ws.projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const rows = await listWorkflowsForSite(locationId);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      locationId,
      count: rows.length,
      workflows: rows.map((wf) => ({
        id: wf.id,
        code: wf.code,
        name: wf.name,
        subject: wf.subjectType,
        active: wf.active,
        totalSla: wf.activities.reduce((s, a) => s + a.slaDays, 0),
        activities: wf.activities,
      })),
    });
  } catch {
    const workflows = buildWorkflowsForSite(locationId).map((wf) => ({
      id: wf.id,
      code: wf.code,
      name: wf.name,
      subject: wf.subject,
      active: wf.active,
      totalSla: workflowTotalSla(wf),
      activities: wf.activities,
    }));
    return NextResponse.json({ source: "config", locationId, count: workflows.length, workflows });
  }
}

/**
 * POST /api/master-timeframe
 * Body: { projectCode, locationId, subjectType, code, name, activities: [{ order, name, slaDays, pic }] }
 *
 * Persists a confirmed workflow timeframe (the step after /preview): upserts the
 * workflow for the site + subject and replaces its activities atomically.
 * Leader/Super Admin or the site's own admin only.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const subjectType = typeof body.subjectType === "string" ? body.subjectType : "";
  const code = typeof body.code === "string" ? body.code : "";
  const name = typeof body.name === "string" ? body.name : "";
  const rawActivities = Array.isArray(body.activities) ? body.activities : [];

  if (!projectCode || !locationId || !subjectType || !name) {
    return NextResponse.json(
      { error: "projectCode, locationId, subjectType, dan name wajib diisi." },
      { status: 400 },
    );
  }
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menyimpan timeframe." }, { status: 403 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Normalize + validate activities.
  const activities: WorkflowActivityInput[] = [];
  for (let i = 0; i < rawActivities.length; i++) {
    const a = rawActivities[i] as Record<string, unknown>;
    const actName = typeof a?.name === "string" ? a.name.trim() : "";
    const slaDays = Number(a?.slaDays);
    if (!actName) {
      return NextResponse.json({ error: `Aktivitas #${i + 1} tidak punya nama.` }, { status: 422 });
    }
    if (Number.isNaN(slaDays) || slaDays < 0) {
      return NextResponse.json({ error: `SLA aktivitas "${actName}" tidak valid.` }, { status: 422 });
    }
    activities.push({
      orderIndex: typeof a?.order === "number" ? a.order : i,
      name: actName,
      slaDays,
      pic: typeof a?.pic === "string" ? a.pic : null,
    });
  }
  if (activities.length === 0) {
    return NextResponse.json({ error: "Workflow harus punya minimal satu aktivitas." }, { status: 422 });
  }
  // Refuse when the workflow master is locked (Master Lock & Version Management).
  const wfLock = await assertDomainUnlocked("workflow");
  if (!wfLock.ok) return NextResponse.json({ error: wfLock.message }, { status: wfLock.status });

  try {
    const id = await saveWorkflow({
      projectCode,
      locationId,
      subjectType,
      code: code || `${subjectType.toUpperCase()}-${locationId}`,
      name,
      activities,
      createdBy: persona.name,
    });
    await autoVersionDomain("workflow", `Simpan workflow "${name}" @ ${locationId}`, persona.name);
    return NextResponse.json({ ok: true, id, savedActivities: activities.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan workflow." }, { status: 500 });
  }
}

/**
 * PATCH /api/master-timeframe
 * Body: { projectCode, locationId, subjectType, active }
 *
 * Toggles a workflow's active flag for a site + subject. An inactive workflow is
 * retained (not deleted) so historical references stay intact, but is skipped by
 * SLA monitoring. Leader/Super Admin or the site's own admin only.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const subjectType = typeof body.subjectType === "string" ? body.subjectType : "";
  const active = Boolean(body.active);

  if (!projectCode || !locationId || !subjectType) {
    return NextResponse.json(
      { error: "projectCode, locationId, dan subjectType wajib diisi." },
      { status: 400 },
    );
  }
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah status." }, { status: 403 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    await setWorkflowActive(locationId, subjectType, active);
    await writeAuditLog({
      locationId,
      category: "master",
      action: active ? "workflow.activate" : "workflow.deactivate",
      actor: persona.name,
      entityType: "master_workflow",
      entityId: `${locationId}:${subjectType}`,
      detail: active ? "Aktifkan workflow timeframe." : "Nonaktifkan workflow timeframe.",
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
