import { NextResponse, type NextRequest } from "next/server";
import {
  getDailySubmissionById,
  listDailySubmissionHistory,
} from "@/db/repositories/daily-submission-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/persetujuan-daily-sales/:id
 *
 * Returns a Daily Sales submission's detail together with its approval history
 * (submit / review / approve / reject trail), enforcing site access.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const submission = await getDailySubmissionById(id);
    if (!submission) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, submission.locationId, submission.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke pengajuan ini." }, { status: 403 });
    }
    const history = await listDailySubmissionHistory(id);
    return NextResponse.json({
      source: "db",
      submission,
      history: history.map((h) => ({
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actor: h.actor,
        reason: h.reason,
        at: h.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
