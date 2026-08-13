import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { parseWorkflowActivities } from "@/lib/mock/workflow-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/master-timeframe/preview
 * Body: { csv, projectCode?, locationId?, subject? }
 *
 * Parses an uploaded Excel-as-CSV of workflow activities and returns a validated
 * preview WITHOUT persisting — the dry-run step before the save endpoint commits
 * the workflow. Reuses the same `parseWorkflowActivities` parser the UI uses so
 * the preview is identical client- and server-side. Expected columns:
 * `Aktivitas, PIC, SLA (hari)`.
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
  const projectCode = typeof body.projectCode === "string" ? body.projectCode : undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;
  const subject = typeof body.subject === "string" ? body.subject : undefined;

  if (!csv.trim()) {
    return NextResponse.json({ error: "csv wajib diisi." }, { status: 400 });
  }
  // Only Leader/Super Admin (or a site's own admin) may upload master timeframes.
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah timeframe." }, { status: 403 });
  }
  if (projectCode && locationId && !canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const result = parseWorkflowActivities(csv);
  if (result.activities.length === 0) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }

  const validRows = result.activities.filter((a) => !a.error);
  return NextResponse.json({
    subject: subject ?? null,
    total: result.activities.length,
    valid: validRows.length,
    invalid: result.errorCount,
    totalSla: validRows.reduce((sum, a) => sum + a.slaDays, 0),
    preview: result.activities,
  });
}
