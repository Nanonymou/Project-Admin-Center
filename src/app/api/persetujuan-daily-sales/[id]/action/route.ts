import { NextResponse, type NextRequest } from "next/server";
import {
  getDailySubmissionById,
  transitionDailySubmission,
  type SubmissionAction,
} from "@/db/repositories/daily-submission-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

const ACTIONS: SubmissionAction[] = ["submit", "review", "approve", "reject", "resubmit"];
/** Actions that require the approve capability (review decisions). */
const REVIEW_ACTIONS = new Set<SubmissionAction>(["review", "approve", "reject"]);

/**
 * POST /api/persetujuan-daily-sales/:id/action
 * Body: { action, reason? }
 *
 * Applies an approval action (submit / review / approve / reject / resubmit) to a
 * Daily Sales submission. The transition is validated against the current status;
 * review actions require the approve capability; a reject requires a reason. The
 * change is recorded in the submission's approval history and the activity log.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const action = body.action as SubmissionAction;
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action harus salah satu: ${ACTIONS.join(", ")}.` }, { status: 400 });
  }
  if (action === "reject" && (!reason || reason.length < 3)) {
    return NextResponse.json({ error: "Penolakan memerlukan reason (minimal 3 karakter)." }, { status: 422 });
  }
  if (REVIEW_ACTIONS.has(action) && !persona.capabilities.canApprove) {
    return NextResponse.json({ error: "Tidak memiliki hak persetujuan." }, { status: 403 });
  }

  try {
    const existing = await getDailySubmissionById(id);
    if (!existing) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke pengajuan ini." }, { status: 403 });
    }

    const result = await transitionDailySubmission(id, action, persona.name, reason);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    try {
      await writeAuditLog({
        projectId: existing.projectId,
        locationId: existing.locationId,
        category: "daily_sales_approval",
        action,
        actor: persona.name,
        entityType: "daily_submission",
        entityId: id,
        detail: `Persetujuan Daily Sales: ${action} → ${result.submission.status}${reason ? ` (${reason})` : ""}.`,
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({ source: "db", submission: result.submission });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
