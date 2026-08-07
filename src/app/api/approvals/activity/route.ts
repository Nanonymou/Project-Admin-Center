import { NextResponse, type NextRequest } from "next/server";
import { recordApprovalActivity } from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateApprovals } from "@/lib/server/approval-cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/activity
 * Body: { approvalId, projectId?, locationId?, note?, assignedTo? }
 *
 * Appends an activity to an approval (a comment and/or reassignment) without
 * changing its stage, records history, and revalidates the approval caches.
 * Requires an authenticated, non-viewer persona whose scope covers the subject.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat memperbarui aktivitas approval." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
  const note = typeof body.note === "string" ? body.note : undefined;
  const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo : undefined;
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;

  if (!approvalId || (!note && !assignedTo)) {
    return NextResponse.json(
      { error: "approvalId dan minimal salah satu dari note / assignedTo wajib diisi." },
      { status: 400 },
    );
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const result = await recordApprovalActivity({ approvalId, actor: persona.name, note, assignedTo });
    if (!result) return NextResponse.json({ error: "Approval tidak ditemukan." }, { status: 404 });
    revalidateApprovals();
    return NextResponse.json({ source: "db", ...result });
  } catch (err) {
    revalidateApprovals();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Aktivitas approval dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      activity: { approvalId, note, assignedTo },
    });
  }
}
