import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { parseWorkflowActivities } from "@/lib/mock/workflow-config";
import { saveWorkflow, type WorkflowActivityInput } from "@/db/repositories/workflow-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/master-timeframe/upload
 * Body: { csv, projectCode, locationId, subjectType, code?, name }
 *
 * One-shot Excel upload → parse → save. Combines the /preview parser with the
 * base save endpoint so the confirmed Excel export is persisted in a single call:
 * the CSV is parsed with the same `parseWorkflowActivities` the UI uses, rejected
 * (422) if any row is invalid, otherwise the workflow is upserted for the site +
 * subject and its activities replaced atomically. Leader/Super Admin or the
 * site's own admin only. Expected columns: `Aktivitas, PIC, SLA (hari)`.
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

  const csv = typeof body.csv === "string" ? body.csv : "";
  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const subjectType = typeof body.subjectType === "string" ? body.subjectType : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!csv.trim()) {
    return NextResponse.json({ error: "csv wajib diisi." }, { status: 400 });
  }
  if (!projectCode || !locationId || !subjectType || !name) {
    return NextResponse.json(
      { error: "projectCode, locationId, subjectType, dan name wajib diisi." },
      { status: 400 },
    );
  }
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah timeframe." }, { status: 403 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Parse the Excel-as-CSV with the shared parser, then reject invalid uploads
  // outright — an all-or-nothing save keeps the persisted workflow consistent.
  const parsed = parseWorkflowActivities(csv);
  if (parsed.activities.length === 0) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }
  if (parsed.errorCount > 0) {
    const firstError = parsed.activities.find((a) => a.error);
    return NextResponse.json(
      {
        error: `Terdapat ${parsed.errorCount} baris tidak valid — perbaiki sebelum menyimpan.`,
        firstError: firstError
          ? { row: firstError.order + 1, name: firstError.name, message: firstError.error }
          : null,
        invalid: parsed.errorCount,
        total: parsed.activities.length,
      },
      { status: 422 },
    );
  }

  const activities: WorkflowActivityInput[] = parsed.activities.map((a) => ({
    orderIndex: a.order,
    name: a.name,
    slaDays: a.slaDays,
    pic: a.pic,
  }));

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
    await writeAuditLog({
      locationId,
      category: "master",
      action: "workflow.upload",
      actor: persona.name,
      entityType: "master_workflow",
      entityId: id,
      detail: `Unggah timeframe "${name}" (${activities.length} aktivitas) via Excel.`,
    });
    return NextResponse.json(
      { ok: true, id, savedActivities: activities.length, totalSla: activities.reduce((s, a) => s + a.slaDays, 0) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan workflow (database tidak tersedia)." }, { status: 503 });
  }
}
