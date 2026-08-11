import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { saveWorkflow, type WorkflowActivityInput } from "@/db/repositories/workflow-repository";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: true, id, savedActivities: activities.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan workflow." }, { status: 500 });
  }
}
